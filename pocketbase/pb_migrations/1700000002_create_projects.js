exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'projects',
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
          name: 'color',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'icon',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'domain',
          type: 'relation',
          options: { collectionId: 'domains', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'status',
          type: 'select',
          options: { values: ['active', 'paused', 'archived'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'tags',
          type: 'relation',
          options: { collectionId: 'tags', maxSelect: 10, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'goal',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'deadline',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'progress',
          type: 'number',
          options: { min: 0, max: 100 }
        }),
        app.models.NewSchemaField({
          name: 'members',
          type: 'json',
          options: {}
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('projects');
    return app.delete(collection);
  }
};
