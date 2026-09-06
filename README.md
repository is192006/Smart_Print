# SmartPrint 🖨️

SmartPrint is a smart college printing management system designed to eliminate long queues at campus printing shops.

Instead of waiting physically at the printing counter, students can upload their documents online, select printing requirements, make a payment, and receive a token. The printing staff can process orders through a priority-based queue system, allowing students to collect their documents when they are ready.

---

## 🚀 Problem Statement

Traditional college printing shops often suffer from:

- Long queues during peak hours
- Students waiting physically for their documents
- Inefficient FIFO-based order management
- Difficulty handling urgent printing requests
- Manual order and payment management
- Lack of visibility into order status

SmartPrint aims to solve these problems through an online and intelligent printing workflow.

---

## 💡 Solution

SmartPrint provides a centralized platform where students can:

1. Log in using their authorized college email.
2. Upload documents for printing.
3. Select printing requirements.
4. View the estimated printing cost.
5. Make an online payment.
6. Receive a printing token.
7. Track the status of their order.
8. Collect their documents once they are ready.

The printing shop receives all orders through a centralized dashboard and can process them using a priority-based queue.

---

## ✨ Key Features

### 👩‍🎓 Student Features

- College email-based authentication
- Online document upload
- PDF/document validation
- Print configuration
- Automatic cost calculation
- Online payment
- Token generation
- Order status tracking
- Order history

### 🖨️ Printing Shop Features

- Centralized order dashboard
- Queue management
- Priority-based scheduling
- FIFO scheduling for normal orders
- Priority handling for urgent orders
- Order status updates
- Print job management

### ⚡ Smart Queue Management

Instead of relying only on First-In-First-Out (FIFO), SmartPrint supports dynamic priority scheduling.

Orders can be prioritized based on factors such as:

- Urgency
- Waiting time
- Number of pages
- Order type
- Current queue conditions

This helps reduce unnecessary waiting and improves printing-shop efficiency.

---

## 🏗️ System Architecture

```text
Student
   │
   ▼
SmartPrint Web Application
   │
   ├── Authentication
   │
   ├── Document Upload
   │
   ├── Order Management
   │
   ├── Payment
   │
   └── Token Generation
            │
            ▼
      Queue Management
            │
            ├── FIFO Queue
            └── Priority Queue
            │
            ▼
      Printing Shop
            │
            ▼
       Order Completed
