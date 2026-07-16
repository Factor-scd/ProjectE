module.exports = {
  up: async (app) => {
    const collection = new app.models.Collection({
      name: 'note_links',
      type: 'base',
      schema: app.models.NewSchema([
        app.models.NewSchemaField({
          name: 'source_note_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'notes', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'target_note_id',
          type: 'relation',
          required: true,
          options: { collectionId: 'notes', maxSelect: 1, cascadeDelete: true }
        }),
        app.models.NewSchemaField({
          name: 'link_text',
          type: 'text',
          options: { maxSize: 255 }
        })
      ]),
      indexes: [
        'CREATE INDEX idx_note_links_source ON note_links (source_note_id)',
        'CREATE INDEX idx_note_links_target ON note_links (target_note_id)'
      ]
    });
    return app.save(collection);
  },
  down: async (app) => {
    const collection = await app.findCollectionByNameOrId('note_links');
    return app.delete(collection);
  }
};
