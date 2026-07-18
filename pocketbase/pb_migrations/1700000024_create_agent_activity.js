exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'agent_activity',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'agent_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'agents', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'action',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'entity_type',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'entity_id',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'before_state',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'after_state',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'prompt',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'response',
          type: 'text',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_agent_activity_agent_id ON agent_activity (agent_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('agent_activity');
    return app.delete(collection);
  }
};
