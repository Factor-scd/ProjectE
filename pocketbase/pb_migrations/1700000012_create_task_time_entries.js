exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'task_time_entries',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'task_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'tasks', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'duration',
          type: 'number',
          required: true,
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'started_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'ended_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'source',
          type: 'select',
          options: { values: ['manual', 'timer', 'pomodoro'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'notes',
          type: 'text',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_task_time_entries_task_id ON task_time_entries (task_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('task_time_entries');
    return app.delete(collection);
  }
};
