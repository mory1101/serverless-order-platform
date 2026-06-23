# Serverless Order Processing Platform

An event-driven serverless application built on Microsoft Azure to explore asynchronous processing, distributed systems patterns, reliability engineering, and cloud-native architecture.

## Overview

This project simulates a real-world order processing workflow where customer orders are accepted through an API and processed asynchronously using Azure Functions and Azure Service Bus.

The goal is to demonstrate:

* Event-driven architecture
* Serverless computing
* Asynchronous processing
* Message-based communication
* Retry and failure handling
* Idempotent design principles
* Cloud-native application patterns

## Architecture

```text
Customer
    ↓
CreateOrder (HTTP Trigger)
    ↓
Azure Service Bus Queue
    ↓
ProcessOrder (Queue Trigger)
    ↓
Business Processing
```

### Current Workflow

1. Customer submits an order through the CreateOrder API.
2. The API generates a unique Order ID.
3. An order message is published to Azure Service Bus.
4. ProcessOrder automatically consumes the message.
5. The order is processed asynchronously.
6. Azure Service Bus manages retries if processing fails.

## Technologies

* Azure Functions
* Azure Service Bus
* Node.js
* JavaScript
* Azure Functions Core Tools

## Reliability Testing

The project includes intentional failure scenarios to study:

* Message retries
* Delivery counts
* Dead-letter queues
* At-least-once delivery guarantees
* Failure recovery patterns

## Current Progress

### Completed

* HTTP-triggered Azure Function
* Service Bus queue integration
* Queue-triggered Azure Function
* End-to-end event flow
* Retry and failure testing
* Delivery count verification

### In Progress

* Azure SQL integration
* Order state persistence
* Processing lifecycle tracking

### Planned

* Managed Identity authentication
* Azure Key Vault integration
* Event Grid / publish-subscribe patterns
* Application Insights observability
* Infrastructure as Code with Terraform
* CI/CD with GitHub Actions

## Key Concepts Explored

* Event-driven architecture
* Distributed systems
* Serverless design patterns
* Message durability
* Retry strategies
* Dead-letter queues
* State transitions
* Back-pressure and scalability

## Learning Objective

This project is being developed incrementally to gain a deeper understanding of how cloud-native serverless systems behave under normal operation and failure conditions, with a focus on the architectural principles behind modern distributed applications.
