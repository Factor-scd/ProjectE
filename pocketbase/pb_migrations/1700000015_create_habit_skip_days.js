exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'habit_skip_days',
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
          name: 'reason',
          type: 'text',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_habit_skip_days_habit_id ON habit_skip_days (habit_id)',
        'CREATE INDEX idx_habit_skip_days_date ON habit_skip_days (date)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('habit_skip_days');
    return app.delete(collection);
  }
};
