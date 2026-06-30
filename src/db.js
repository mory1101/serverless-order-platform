const sql = require('mssql');

let pool;

async function getPool() {
    if (pool) return pool;

    pool = await sql.connect({
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        options: {
            encrypt: true
        },
        authentication: {
            type: 'azure-active-directory-default'
        }
    });

    return pool;
}

async function insertPendingOrder(order) {
    const db = await getPool();
    const dbTransaction = new sql.Transaction(db);

    try {
        await dbTransaction.begin();

        const orderRequest = new sql.Request(dbTransaction);

        await orderRequest
            .input('OrderId', sql.UniqueIdentifier, order.orderId)
            .input('CustomerId', sql.NVarChar(100), order.customerId)
            .input('ProductId', sql.NVarChar(100), order.productId)
            .input('Quantity', sql.Int, order.quantity)
            .input('Status', sql.NVarChar(50), 'Pending')
            .input('CorrelationId', sql.UniqueIdentifier, order.correlationId)
            .query(`
                INSERT INTO Orders (
                    OrderId,
                    CustomerId,
                    ProductId,
                    Quantity,
                    Status,
                    CreatedAt,
                    UpdatedAt,
                    CorrelationId
                )
                VALUES (
                    @OrderId,
                    @CustomerId,
                    @ProductId,
                    @Quantity,
                    @Status,
                    SYSUTCDATETIME(),
                    SYSUTCDATETIME(),
                    @CorrelationId
                );
            `);

        const outboxRequest = new sql.Request(dbTransaction);

        await outboxRequest
            .input('Id', sql.UniqueIdentifier, order.outboxMessageId)
            .input('MessageType', sql.NVarChar(100), order.messageType)
            .input('Payload', sql.NVarChar(sql.MAX), JSON.stringify(order.payload))
            .input('CorrelationId', sql.UniqueIdentifier, order.correlationId)
            .query(`
                INSERT INTO OutboxMessages (
                    Id,
                    MessageType,
                    Payload,
                    Status,
                    CreatedAt,
                    CorrelationId
                )
                VALUES (
                    @Id,
                    @MessageType,
                    @Payload,
                    'Pending',
                    SYSUTCDATETIME(),
                    @CorrelationId
                );
            `);

        await dbTransaction.commit();

    } catch (error) {
        try {
            await dbTransaction.rollback();
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
        }

        throw error;
    }
}


async function updateOrderStatus(orderId, status) {
    const db = await getPool();

    const timestampColumn =
        status === 'Processing' ? 'ProcessingStartedAt' :
        status === 'Processed' ? 'ProcessedAt' :
        null;

    const timestampUpdate = timestampColumn
        ? `, ${timestampColumn} = SYSUTCDATETIME()`
        : '';

    await db.request()
        .input('OrderId', sql.UniqueIdentifier, orderId)
        .input('Status', sql.NVarChar(50), status)
        .query(`
            UPDATE Orders
            SET
                Status = @Status,
                UpdatedAt = SYSUTCDATETIME()
                ${timestampUpdate}
            WHERE OrderId = @OrderId;
        `);
}

async function markOrderFailed(orderId, failureReason, retryCount) {
    const db = await getPool();

    await db.request()
        .input('OrderId', sql.UniqueIdentifier, orderId)
        .input('FailureReason', sql.NVarChar(1000), failureReason)
        .input('RetryCount', sql.Int, retryCount)
        .query(`
            UPDATE Orders
            SET
                Status = 'Failed',
                FailedAt = SYSUTCDATETIME(),
                FailureReason = @FailureReason,
                RetryCount = @RetryCount,
                UpdatedAt = SYSUTCDATETIME()
            WHERE OrderId = @OrderId;
        `);
}

async function getPendingOutboxMessages() {
    const db = await getPool();

    const result = await db.request()
        .query(`
            UPDATE TOP (10) OutboxMessages
            SET Status = 'Publishing'
            OUTPUT
                inserted.Id,
                inserted.MessageType,
                inserted.Payload,
                inserted.CorrelationId,
                inserted.RetryCount
            WHERE Status = 'Pending'
            OR  (
                    Status = 'Publishing'
                    AND PublishingStartedAt < DATEADD(minute, -5, SYSUTCDATETIME())
                )
        `);

    return result.recordset;
}

async function markOutboxMessagePublished(id) {
    const db = await getPool();

    await db.request()
        .input('Id', sql.UniqueIdentifier, id)
        .query(`
            UPDATE OutboxMessages
            SET
                Status = 'Published',
                PublishedAt = SYSUTCDATETIME(),
                LastError = NULL
            WHERE Id = @Id;
        `);
}

async function markOutboxMessageFailed(id, error) {
    const db = await getPool();

    await db.request()
        .input('Id', sql.UniqueIdentifier, id)
        .input('LastError', sql.NVarChar(sql.MAX), error.message || String(error))
        .query(`
            UPDATE OutboxMessages
            SET
                RetryCount = RetryCount + 1,
                LastError = @LastError,
                Status = CASE
                    WHEN RetryCount + 1 >= 5 THEN 'Failed'
                    ELSE 'Pending'
                END
            WHERE Id = @Id;
        `);
}

async function checkSqlHealth() {
    const db = await getPool();

    await db.request().query(`
        SELECT 1 AS HealthCheck;
    `);
}

module.exports = {
    insertPendingOrder,
    updateOrderStatus,
    markOrderFailed,
    getPendingOutboxMessages,
    markOutboxMessagePublished,
    markOutboxMessageFailed,
    checkSqlHealth
};

 