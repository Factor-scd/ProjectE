exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'habit_logs',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'habit_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'habits', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'date',
          type: 'date',
          required: true,
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'mood',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'quantity',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'notes',
          type: 'text',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_habit_logs_habit_id ON habit_logs (habit_id)',
        'CREATE INDEX idx_habit_logs_date ON habit_logs (date)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('habit_logs');
    return app.delete(collection);
  }
};
