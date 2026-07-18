exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'reports',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'title',
          type: 'text',
          required: true,
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'content',
          type: 'text',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'report_type',
          type: 'select',
          options: { values: ['weekly', 'monthly', 'project', 'habit', 'custom'], maxSelect: 1 }
        }),
        app.models.NewSchemaField({
          name: 'date_range_start',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'date_range_end',
          type: 'date',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'generated_by',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'ai_generated',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'linked_entities',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'domain',
          type: 'relation',
          options: { collectionId: 'domains', maxSelect: 1, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'tags',
          type: 'relation',
          options: { collectionId: 'tags', maxSelect: 10, cascadeDelete: false }
        }),
        app.models.NewSchemaField({
          name: 'template_id',
          type: 'relation',
          options: { collectionId: 'report_templates', maxSelect: 1, cascadeDelete: false }
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('reports');
    return app.delete(collection);
  }
};
