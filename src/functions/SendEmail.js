const { app } = require('@azure/functions');

app.eventGrid('SendEmail', {
    handler: (event, context) => {
        context.log('Event grid function processed event:', event);

        
    }
});
