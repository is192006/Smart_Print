# 🖨️ SmartPrint

> A smart, queue-based printing management system designed to make college printing faster, easier, and more efficient.

## 📌 Overview

**SmartPrint** is a digital printing management system designed for college students and printing shops.

Traditional college printing often requires students to physically visit the printing shop, wait in long queues, submit documents, and wait for their prints. SmartPrint aims to reduce this waiting time by allowing students to submit print requests digitally and track their requests through a token-based queue system.

The system is designed around **remote print submission, queue management, priority handling, document validation, and token generation**.

---

## 🎯 Problem Statement

College printing shops often face:

- Long queues during peak hours
- Students waiting unnecessarily at the printing shop
- Manual handling of print requests
- Difficulty managing multiple print requests
- No effective priority mechanism
- Increased workload for printing-shop staff
- Lack of visibility into the status of a print request

Students also have to spend considerable time waiting for their documents to be printed.

### 💡 Our Solution

SmartPrint provides a centralized platform where students can:

1. Upload their documents remotely.
2. Provide printing requirements.
3. Receive a token for their request.
4. Track their position/status in the queue.
5. Visit the printing shop when their document is ready.

This reduces unnecessary waiting and improves the overall efficiency of the printing process.

---

## ✨ Key Features

### 👨‍🎓 Student Features

- 🔐 College email-based authorization
- 📄 Upload documents for printing
- 🖨️ Specify printing requirements
- 🎫 Generate a unique print token
- 📊 Track print request status
- ⏱️ Reduce physical waiting time
- 📋 View submitted print requests

### 🏪 Printing Shop Features

- 📥 View incoming print requests
- 📋 Manage the printing queue
- 🔄 Update request status
- ⚡ Handle priority requests
- 🖨️ Process documents efficiently
- 📊 Manage active and completed requests

### ⚙️ Queue Management

SmartPrint supports intelligent queue management instead of relying only on simple FIFO ordering.

The system can consider factors such as:

- Request priority
- Submission time
- Printing requirements
- Queue position

This allows urgent requests to be handled more efficiently while maintaining fairness in the queue.

---

## 🔄 System Workflow

```text
Student
   │
   ▼
Login / Authorization
   │
   ▼
Upload Document
   │
   ▼
Enter Printing Details
   │
   ▼
Submit Print Request
   │
   ▼
Request Added to Queue
   │
   ▼
Token Generated
   │
   ▼
Printing Shop Processes Request
   │
   ▼
Request Status Updated
   │
   ▼
Student Collects Printed Document