module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'milestone_history',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'milestone_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'milestones', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'old_status',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'new_status',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'changed_by',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'changed_at',
          type: 'date',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_milestone_history_milestone_id ON milestone_history (milestone_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('milestone_history');
    return app.delete(collection);
  }
};
