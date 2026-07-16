module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'notifications',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'title',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'message',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'type',
          type: 'select',
          options: { values: ['info', 'success', 'warning', 'error'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'entity_type',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'entity_id',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'read',
          type: 'bool',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_notifications_read ON notifications (read)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('notifications');
    return app.delete(collection);
  }
};
