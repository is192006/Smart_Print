export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiMessage {
  success: true
  message: string
}

export interface ApiErrorBody {
  success: false
  message: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}
