exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'webhook_deliveries',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'webhook_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'webhooks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'event_type',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'payload',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'response_status',
          type: 'number',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'response_body',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'success',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'attempts',
          type: 'number',
          options: { min: 0 }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries (webhook_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('webhook_deliveries');
    return app.delete(collection);
  }
};
