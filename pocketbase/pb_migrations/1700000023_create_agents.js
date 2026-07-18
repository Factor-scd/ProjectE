exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'agents',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'api_key',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'avatar',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'description',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'permission_tier',
          type: 'select',
          options: { values: ['full_access', 'read_only', 'content_creator', 'task_manager', 'custom'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'custom_permissions',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'webhook_url',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'last_activity_at',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'status',
          type: 'select',
          options: { values: ['active', 'disabled'], maxSelect: 1 }
        })
      ]),
      indexes: [
        'CREATE UNIQUE INDEX idx_agents_api_key ON agents (api_key)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('agents');
    return app.delete(collection);
  }
};
