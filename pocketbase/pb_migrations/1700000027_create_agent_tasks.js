module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'agent_tasks',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'agent_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'agents', maxSelect: 1, cascadeDelete: true }
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
          name: 'instruction',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'status',
          type: 'select',
          options: { values: ['pending', 'in_progress', 'completed', 'failed', 'delivery_failed'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'result',
          type: 'json',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_agent_tasks_agent_id ON agent_tasks (agent_id)',
        'CREATE INDEX idx_agent_tasks_status ON agent_tasks (status)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('agent_tasks');
    return app.delete(collection);
  }
};
