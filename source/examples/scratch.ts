import {
  Project,
  Spider,
  HtmlTools,
  TextTools,
} from '../index.js';

const graph = await Project.config({name: 'ethan'}).then(project => project.graph());
await graph.erase({eraseAll: true});

const spider = new Spider({
  logLevel: 0,
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
  .then(results => console.log(results));
