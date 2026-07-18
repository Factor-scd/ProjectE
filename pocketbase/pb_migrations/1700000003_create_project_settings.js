exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'project_settings',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'project_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'projects', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'default_priority',
          type: 'select',
          options: { values: ['low', 'medium', 'high', 'urgent'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'default_domain',
          type: 'relation',
          options: { collectionId: 'domains', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'default_tags',
          type: 'relation',
          options: { collectionId: 'tags', maxSelect: 10, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'auto_archive_completed_after_days',
          type: 'number',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'default_view',
          type: 'select',
          options: { values: ['kanban', 'list'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'habit_reminder_time_default',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'pomodoro_focus_minutes',
          type: 'number',
          options: { min: 1, max: 120 }
        }),
        app.models.NewSchemaField({
          name: 'pomodoro_break_minutes',
          type: 'number',
          options: { min: 1, max: 60 }
        }),
        app.models.NewSchemaField({
          name: 'accent_color_override',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'milestone_dependency_enforcement',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'custom_fields',
          type: 'json',
          options: {}
        })
      ]),
      indexes: [
        'CREATE UNIQUE INDEX idx_project_settings_project_id ON project_settings (project_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('project_settings');
    return app.delete(collection);
  }
};
