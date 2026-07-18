exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'task_dependencies',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'depends_on_task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_task_dependencies_task_id ON task_dependencies (task_id)',
        'CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies (depends_on_task_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('task_dependencies');
    return app.delete(collection);
  }
};
