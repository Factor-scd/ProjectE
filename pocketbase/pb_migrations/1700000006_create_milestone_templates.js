exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'milestone_templates',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'name',
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
          name: 'milestones',
          type: 'json',
          options: {}
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('milestone_templates');
    return app.delete(collection);
  }
};
