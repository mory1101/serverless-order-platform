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

    await db.request()
        .input('OrderId', sql.UniqueIdentifier, order.orderId)
        .input('CustomerId', sql.NVarChar(100), order.customerId)
        .input('ProductId', sql.NVarChar(100), order.productId)
        .input('Quantity', sql.Int, order.quantity)
        .input('Status', sql.NVarChar(50), 'Pending')
        .query(`
            INSERT INTO Orders (
                OrderId,
                CustomerId,
                ProductId,
                Quantity,
                Status,
                CreatedAt,
                UpdatedAt
            )
            VALUES (
                @OrderId,
                @CustomerId,
                @ProductId,
                @Quantity,
                @Status,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );
        `);
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

module.exports = {
    insertPendingOrder,
    updateOrderStatus,
    markOrderFailed
};