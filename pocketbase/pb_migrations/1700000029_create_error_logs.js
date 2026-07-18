exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'error_logs',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'code',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'message',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'details',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'stack_trace',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'source',
          type: 'text',
          options: { maxSize: 255 }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_error_logs_code ON error_logs (code)',
        'CREATE INDEX idx_error_logs_source ON error_logs (source)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('error_logs');
    return app.delete(collection);
  }
};
