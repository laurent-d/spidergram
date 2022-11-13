import {
  Project,
  Spider,
  HtmlTools,
  TextTools,
} from '../index.js';

await Project.config({name: 'ethan'})
  .then(project => project.graph())
  .then(graph => { graph.erase({eraseAll: true}); });

const spider = new Spider({
  async pageHandler(context) {
    const {$, saveResource, enqueueUrls} = context;

    const body = $!.html();
    const meta = HtmlTools.getMetadata($!);
    const text = HtmlTools.getPlainText(body, {
      baseElements: {selectors: ['section.page-content']},
    });
    const readability = TextTools.calculateReadability(text);

    await saveResource({meta, text, readability,});
    await enqueueUrls();
  },
});
await spider.run(['https://ethanmarcotte.com'])
  .then(results => console.log);