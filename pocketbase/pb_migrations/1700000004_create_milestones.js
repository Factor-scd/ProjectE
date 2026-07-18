exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'milestones',
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
          name: 'project_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'projects', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'status',
          type: 'select',
          options: { values: ['planned', 'in_progress', 'complete'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'due_date',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'sort_order',
          type: 'number',
          options: {}
        })
      ]),
      indexes: [
        'CREATE INDEX idx_milestones_project_id ON milestones (project_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('milestones');
    return app.delete(collection);
  }
};
