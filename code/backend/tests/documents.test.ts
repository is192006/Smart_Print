import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import * as documentService from '../src/services/document.service';

const app = createApp();

const TEST_EMAIL_PREFIX = 'doctest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

let uniqueCounter = 0;
function studentEmail(label: string): string {
  uniqueCounter += 1;
  return `${TEST_EMAIL_PREFIX}${label}.${Date.now()}.${uniqueCounter}@${STUDENT_DOMAIN}`;
}

async function registerStudent(label: string): Promise<{ userId: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Doc Test ${label}`,
      email: studentEmail(label),
      password: VALID_PASSWORD,
    });
  expect(res.status).toBe(201);
  return { userId: res.body.data.user.userId, token: res.body.data.token };
}

function fixture(name: string): Buffer {
  return fsSync.readFileSync(path.join(FIXTURES_DIR, name));
}

function attach(
  token: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): request.Test {
  return request(app)
    .post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, { filename, contentType });
}

async function uploadedStorageKeys(): Promise<string[]> {
  try {
    return await fs.readdir(path.resolve(env.uploadDir));
  } catch {
    return [];
  }
}

afterAll(async () => {
  await prisma.document.deleteMany({
    where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await fs.rm(path.resolve(env.uploadDir), { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('authorization / IDOR', () => {
  it('1. unauthenticated user cannot upload', async () => {
    const res = await request(app).post('/api/documents').attach('file', fixture('valid.pdf'), {
      filename: 'valid.pdf',
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(401);
  });

  it('2. unauthenticated user cannot list documents', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('3. unauthenticated user cannot get a document', async () => {
    const res = await request(app).get('/api/documents/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('4. unauthenticated user cannot download', async () => {
    const res = await request(app).get(
      '/api/documents/00000000-0000-0000-0000-000000000000/download',
    );
    expect(res.status).toBe(401);
  });

  it('5. unauthenticated user cannot delete', async () => {
    const res = await request(app).delete('/api/documents/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  describe('Student A / Student B isolation', () => {
    let studentA: { userId: string; token: string };
    let studentB: { userId: string; token: string };
    let documentAId: string;

    beforeAll(async () => {
      studentA = await registerStudent('a-owner');
      studentB = await registerStudent('b-other');

      const uploadRes = await attach(
        studentA.token,
        fixture('valid.pdf'),
        'valid.pdf',
        'application/pdf',
      );
      expect(uploadRes.status).toBe(201);
      documentAId = uploadRes.body.data.document.documentId;
    });

    it('Student B cannot GET Document A (404, not 403 - no existence leak)', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentAId}`)
        .set('Authorization', `Bearer ${studentB.token}`);
      expect(res.status).toBe(404);
    });

    it('Student B cannot download Document A', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentAId}/download`)
        .set('Authorization', `Bearer ${studentB.token}`);
      expect(res.status).toBe(404);
    });

    it('Student B cannot DELETE Document A', async () => {
      const res = await request(app)
        .delete(`/api/documents/${documentAId}`)
        .set('Authorization', `Bearer ${studentB.token}`);
      expect(res.status).toBe(404);

      const stillThere = await prisma.document.findUnique({ where: { documentId: documentAId } });
      expect(stillThere).not.toBeNull();
    });

    it('Student A can GET Document A', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.document.documentId).toBe(documentAId);
    });

    it('Student A can download Document A', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentAId}/download`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('a request body user_id cannot override ownership', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ user_id: studentB.userId });
      expect(res.status).toBe(200);
      // Every returned document must actually belong to Student A.
      for (const doc of res.body.data.documents) {
        const owned = await prisma.document.findUnique({ where: { documentId: doc.documentId } });
        expect(owned?.userId).toBe(studentA.userId);
      }
    });

    it('Student A can delete Document A', async () => {
      const res = await request(app)
        .delete(`/api/documents/${documentAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(200);

      const gone = await prisma.document.findUnique({ where: { documentId: documentAId } });
      expect(gone).toBeNull();
    });
  });
});

describe('file validation', () => {
  let student: { userId: string; token: string };

  beforeAll(async () => {
    student = await registerStudent('validation');
  });

  it('accepts a valid PDF', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'assignment.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('PDF');
  });

  it('accepts a valid image (PNG)', async () => {
    const res = await attach(student.token, fixture('valid.png'), 'photo.png', 'image/png');
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('PNG');
  });

  it('accepts a valid image (JPG)', async () => {
    const res = await attach(student.token, fixture('valid.jpg'), 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('JPG');
  });

  it('accepts a valid DOCX', async () => {
    const res = await attach(
      student.token,
      fixture('valid.docx'),
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('DOCX');
  });

  it('accepts a valid XLSX', async () => {
    const res = await attach(
      student.token,
      fixture('valid.xlsx'),
      'sheet.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('XLSX');
  });

  it('accepts a valid PPTX', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pptx'),
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileType).toBe('PPTX');
  });

  it('rejects when no file is provided', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects an empty (zero-byte) file', async () => {
    const res = await attach(student.token, fixture('empty.pdf'), 'empty.pdf', 'application/pdf');
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported extension', async () => {
    const res = await attach(student.token, fixture('notes.txt'), 'notes.txt', 'text/plain');
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported/mismatched declared MIME type', async () => {
    const res = await attach(student.token, fixture('valid.pdf'), 'assignment.pdf', 'image/png');
    expect(res.status).toBe(400);
  });

  it('rejects extension/content mismatch: real PNG bytes renamed to .pdf', async () => {
    const res = await attach(
      student.token,
      fixture('valid.png'),
      'assignment.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(400);
  });

  it('rejects a fake PDF: executable bytes renamed to document.pdf', async () => {
    const res = await attach(
      student.token,
      fixture('fake-executable.pdf'),
      'document.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(400);
  });

  it('rejects a corrupted PDF (right signature, unparseable body)', async () => {
    const res = await attach(
      student.token,
      fixture('corrupted.pdf'),
      'broken.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(400);
  });

  it('rejects a corrupted image (right signature, undecodable body)', async () => {
    const res = await attach(student.token, fixture('corrupted.png'), 'broken.png', 'image/png');
    expect(res.status).toBe(400);
  });

  it('rejects a DOCX-extension file that is a ZIP but not a real DOCX', async () => {
    const res = await attach(
      student.token,
      fixture('fake-structure.docx'),
      'fake.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.status).toBe(400);
  });

  it('rejects an oversized file', async () => {
    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(env.maxFileSizeBytes + 1024, 0x41),
    ]);
    const res = await attach(student.token, oversized, 'huge.pdf', 'application/pdf');
    expect(res.status).toBe(413);
  });

  it('sanitizes a malicious path-like filename instead of using it as a storage path', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      '../../../etc/evil.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.fileName).not.toMatch(/[\\/]/);
    expect(res.body.data.document.fileName).not.toContain('..');
  });

  it('a duplicate filename does not overwrite the existing file', async () => {
    const first = await attach(
      student.token,
      fixture('valid.pdf'),
      'duplicate.pdf',
      'application/pdf',
    );
    const second = await attach(
      student.token,
      fixture('valid.pdf'),
      'duplicate.pdf',
      'application/pdf',
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.document.documentId).not.toBe(second.body.data.document.documentId);

    const getFirst = await request(app)
      .get(`/api/documents/${first.body.data.document.documentId}`)
      .set('Authorization', `Bearer ${student.token}`);
    const getSecond = await request(app)
      .get(`/api/documents/${second.body.data.document.documentId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(getFirst.status).toBe(200);
    expect(getSecond.status).toBe(200);
  });
});

describe('page count extraction', () => {
  let student: { userId: string; token: string };

  beforeAll(async () => {
    student = await registerStudent('pagecount');
  });

  it('PDF: known 1-page fixture reports pageCount 1', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'one-page.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBe(1);
  });

  it('PNG: one image = one page', async () => {
    const res = await attach(student.token, fixture('valid.png'), 'photo.png', 'image/png');
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBe(1);
  });

  it('JPG: one image = one page', async () => {
    const res = await attach(student.token, fixture('valid.jpg'), 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBe(1);
  });

  it('PPTX: known 3-slide fixture reports pageCount 3', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pptx'),
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBe(3);
  });

  it('DOCX: uses the Word-cached page count when present', async () => {
    const res = await attach(
      student.token,
      fixture('valid.docx'),
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBe(2);
  });

  it('DOCX: reports pageCount null (not a fabricated number) when no cached count exists', async () => {
    const res = await attach(
      student.token,
      fixture('valid-no-pagecount.docx'),
      'draft.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBeNull();
  });

  it('XLSX: reports pageCount null - worksheet count is never used as a page count', async () => {
    const res = await attach(
      student.token,
      fixture('valid.xlsx'),
      'sheet.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBeNull();
  });

  it('legacy .doc: accepted, pageCount explicitly null (unsupported format, documented limitation)', async () => {
    const res = await attach(student.token, fixture('legacy.doc'), 'old.doc', 'application/msword');
    expect(res.status).toBe(201);
    expect(res.body.data.document.pageCount).toBeNull();
  });
});

describe('storage', () => {
  let student: { userId: string; token: string };

  beforeAll(async () => {
    student = await registerStudent('storage');
  });

  it('uploaded file physically exists under the configured upload directory', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'assignment.pdf',
      'application/pdf',
    );
    expect(res.status).toBe(201);

    const document = await prisma.document.findUnique({
      where: { documentId: res.body.data.document.documentId },
    });
    expect(document).not.toBeNull();

    const filePath = path.resolve(env.uploadDir, document!.storageKey);
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('generated storage filename is not the original filename', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'My DBMS Assignment Final.pdf',
      'application/pdf',
    );
    const document = await prisma.document.findUnique({
      where: { documentId: res.body.data.document.documentId },
    });
    expect(document!.storageKey).not.toBe('My DBMS Assignment Final.pdf');
    expect(document!.storageKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
  });

  it('generated storage filenames are unique across uploads', async () => {
    const a = await attach(student.token, fixture('valid.pdf'), 'x.pdf', 'application/pdf');
    const b = await attach(student.token, fixture('valid.pdf'), 'x.pdf', 'application/pdf');
    const docA = await prisma.document.findUnique({
      where: { documentId: a.body.data.document.documentId },
    });
    const docB = await prisma.document.findUnique({
      where: { documentId: b.body.data.document.documentId },
    });
    expect(docA!.storageKey).not.toBe(docB!.storageKey);
  });

  it('the upload directory is not publicly/statically exposed', async () => {
    const res = await attach(student.token, fixture('valid.pdf'), 'private.pdf', 'application/pdf');
    const document = await prisma.document.findUnique({
      where: { documentId: res.body.data.document.documentId },
    });
    const guessedPublicUrl = `/${env.uploadDir}/${document!.storageKey}`.replace(/\\/g, '/');
    const staticRes = await request(app).get(guessedPublicUrl);
    expect(staticRes.status).toBe(404);
  });

  it('a DB failure after saving the file removes the stored file (no orphan)', async () => {
    const beforeKeys = new Set(await uploadedStorageKeys());

    const createSpy = jest
      .spyOn(prisma.document, 'create')
      .mockRejectedValueOnce(new Error('simulated database failure'));

    await expect(
      documentService.uploadDocument(student.userId, {
        buffer: fixture('valid.pdf'),
        originalName: 'db-failure.pdf',
        declaredMimeType: 'application/pdf',
        size: fixture('valid.pdf').length,
      }),
    ).rejects.toThrow('simulated database failure');

    createSpy.mockRestore();

    const afterKeys = await uploadedStorageKeys();
    expect(afterKeys.length).toBe(beforeKeys.size);
  });

  it('a processing (parser) failure never writes a file, so nothing needs cleanup', async () => {
    const beforeKeys = await uploadedStorageKeys();

    await expect(
      documentService.uploadDocument(student.userId, {
        buffer: fixture('corrupted.pdf'),
        originalName: 'broken.pdf',
        declaredMimeType: 'application/pdf',
        size: fixture('corrupted.pdf').length,
      }),
    ).rejects.toThrow();

    const afterKeys = await uploadedStorageKeys();
    expect(afterKeys.length).toBe(beforeKeys.length);
  });

  it('successful deletion removes the physical file', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'to-delete.pdf',
      'application/pdf',
    );
    const documentId = res.body.data.document.documentId;
    const document = await prisma.document.findUnique({ where: { documentId } });
    const filePath = path.resolve(env.uploadDir, document!.storageKey);

    await request(app)
      .delete(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);

    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('a missing physical file is handled safely (no crash) on download', async () => {
    const res = await attach(
      student.token,
      fixture('valid.pdf'),
      'will-vanish.pdf',
      'application/pdf',
    );
    const documentId = res.body.data.document.documentId;
    const document = await prisma.document.findUnique({ where: { documentId } });
    const filePath = path.resolve(env.uploadDir, document!.storageKey);

    await fs.unlink(filePath); // simulate the file disappearing out-of-band

    const downloadRes = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(downloadRes.status).toBe(404);
  });
});

describe('database persistence', () => {
  let student: { userId: string; token: string };

  beforeAll(async () => {
    student = await registerStudent('dbpersist');
  });

  it('persists correct ownership, metadata, hash, page count, storage key, and original filename', async () => {
    const buffer = fixture('valid.pdf');
    const res = await attach(student.token, buffer, 'Original Name.pdf', 'application/pdf');
    expect(res.status).toBe(201);

    const document = await prisma.document.findUnique({
      where: { documentId: res.body.data.document.documentId },
    });
    expect(document).not.toBeNull();
    expect(document!.userId).toBe(student.userId);
    expect(document!.fileName).toBe('Original Name.pdf');
    expect(document!.fileType).toBe('PDF');
    expect(document!.mimeType).toBe('application/pdf');
    expect(document!.fileSize).toBe(buffer.length);
    expect(document!.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(document!.pageCount).toBe(1);
    expect(document!.storageKey).toBeTruthy();
    expect(document!.fileUrl).toBe(`/api/documents/${document!.documentId}/download`);
  });

  it('never exposes password_hash-style internal fields or filesystem paths in the response', async () => {
    const res = await attach(student.token, fixture('valid.pdf'), 'safe.pdf', 'application/pdf');
    const doc = res.body.data.document;
    expect(doc.storageKey).toBeUndefined();
    expect(JSON.stringify(doc)).not.toContain(path.resolve(env.uploadDir));
  });
});
