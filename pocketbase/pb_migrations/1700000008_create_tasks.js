module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'tasks',
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
          name: 'status',
          type: 'select',
          options: { values: ['todo', 'in_progress', 'done', 'cancelled'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'priority',
          type: 'select',
          options: { values: ['low', 'medium', 'high', 'urgent'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'due_date',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'project_id',
          type: 'relation',
          options: { collectionId: 'projects', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'milestone_id',
          type: 'relation',
          options: { collectionId: 'milestones', maxSelect: 1, cascadeDelete: false }
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
          name: 'assignee',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'estimate',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'time_spent',
          type: 'number',
          options: { min: 0 }
        }),
        app.models.NewSchemaField({
          name: 'recurring_config',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'attachments',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'dependencies',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'subtasks',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'custom_fields',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'completed_at',
          type: 'date',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_tasks_project_id ON tasks (project_id)',
        'CREATE INDEX idx_tasks_milestone_id ON tasks (milestone_id)',
        'CREATE INDEX idx_tasks_status ON tasks (status)',
        'CREATE INDEX idx_tasks_priority ON tasks (priority)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('tasks');
    return app.delete(collection);
  }
};
