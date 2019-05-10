/**
 * @type Book
 * represent a portion of information about the book
 * extracted from the OpenLibrary API
 * */
export type Book = {
  author_name: string[],
  title: string,
  cover_i?: number,
  isbn?: string[],
  img_url?: string,
  key?: string
}

/**
 * @interface BookSearchEvent
 * adds additional optional field in the Event which the web component raises
 * the events can be caught by other comcpnents whcih can use the data fetched
 *
 * @member {string} error
 * @member {Book[]} data
 * */
export interface BookSearchEvent extends Event {
  error?: string;
  data?: Book[] | null;
}

/**
 * @interface SpeechWindow
 * defines a stub interface for TypeScript validation
 * because for the reason unkown it does not recognise
 * window.webkitSpeechRecognition() object used in speech recognition API
 *
 * @member {any} webkitSpeechRecognition
 * */
export interface SpeechWindow extends Window {
  webkitSpeechRecognition : any;
}