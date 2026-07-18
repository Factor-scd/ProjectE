exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'milestone_dependencies',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'milestone_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'milestones', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'depends_on_milestone_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'milestones', maxSelect: 1, cascadeDelete: true }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_milestone_dependencies_milestone_id ON milestone_dependencies (milestone_id)',
        'CREATE INDEX idx_milestone_dependencies_depends_on ON milestone_dependencies (depends_on_milestone_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('milestone_dependencies');
    return app.delete(collection);
  }
};
