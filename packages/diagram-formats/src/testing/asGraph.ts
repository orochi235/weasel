import { graphPageOf, type DocumentPage, type GraphPage } from '../document';

/** `page` as the graph page a graph format's test expects; throws on any other kind. */
export const asGraph = (page: DocumentPage): GraphPage => graphPageOf(page, 'the test');
