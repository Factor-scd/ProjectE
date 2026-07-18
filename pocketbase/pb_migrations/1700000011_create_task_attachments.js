exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'task_attachments',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'file',
          type: 'file',
          required: true,
          options: { maxSelect: 1, maxSize: 5242880, mimeTypes: [] }
        }),
        app.models.NewSchemaField({
          name: 'filename',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'mime_type',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'size',
          type: 'number',
          options: { min: 0 }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_task_attachments_task_id ON task_attachments (task_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('task_attachments');
    return app.delete(collection);
  }
};
