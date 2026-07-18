exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'task_subtasks',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'title',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'done',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'sort_order',
          type: 'number',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_task_subtasks_task_id ON task_subtasks (task_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('task_subtasks');
    return app.delete(collection);
  }
};
