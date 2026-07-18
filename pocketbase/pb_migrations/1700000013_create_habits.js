exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'habits',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'title',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'description',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'frequency',
          type: 'select',
          options: { values: ['daily', 'weekly', 'custom'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'cron_expression',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'target_count',
          type: 'number',
          options: { min: 1 }
        }),
        app.models.NewSchemaField({
          name: 'streak_current',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'streak_best',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'last_completed_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'project_id',
          type: 'relation',
          options: { collectionId: 'projects', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'tags',
          type: 'relation',
          options: { collectionId: 'tags', maxSelect: 10, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'domain',
          type: 'relation',
          options: { collectionId: 'domains', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'difficulty',
          type: 'select',
          options: { values: ['easy', 'medium', 'hard'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'mood_tracking',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'reminder_times',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'skip_days',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'unit',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'goal_per_period',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'score',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'score_config',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'completion_mode',
          type: 'select',
          options: { values: ['quick', 'detailed'], maxSelect: 1 }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_habits_project_id ON habits (project_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('habits');
    return app.delete(collection);
  }
};
