exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'notes',
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
          name: 'linked_entities',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'created_by',
          type: 'text',
          options: { maxSize: 255 }
        }),
        app.models.NewSchemaField({
          name: 'ai_generated',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'bookmarked',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'pinned',
          type: 'bool',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'frontmatter',
          type: 'json',
          options: {}
        }),
        app.models.NewSchemaField({
          name: 'wikilinks',
          type: 'json',
          options: {}
        })
      ]),
      indexes: []
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('notes');
    return app.delete(collection);
  }
};
