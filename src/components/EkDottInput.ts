import {Book, BookSearchEvent, SpeechWindow} from '../types';
import {format as formatTimeAgo} from 'timeago.js';

const componentStyles = `
    <style>
        :host {
            font-family: sans-serif;
            border: 2px solid purple;
            padding: 1rem;
            margin: 1rem;
            display: block;
            width: 25rem;
            max-width: 100%;
        }
        #search-input {
            font: inherit;
            color: purple;
            padding: 0.1rem 0.25rem;
            font-size: 1rem;
            width: 70%;
        }
        #search-input:focus {
            outline: none;
        }
        #search-button {
            font: inherit;
            border: 1px solid purple;
            color: white;
            background: purple;
            cursor: pointer;
            padding: 0.1rem 0.25rem;
        }
        
        #search-button:hover,
        #search-button:active {
            background: #8a3c8a;
            border-color: #8a3c8a;
        }
        
        #search-button:focus {
            outline: none;
        }
        
        #search-button:disabled {
            background: #ccc;
            border-color: #ccc;
            cursor: not-allowed;
        }
        .fas {
            display: inline-block;
            font: normal normal normal 14px/1 FontAwesome;
            font-size: inherit;
            line-height: 1;
            font-size: inherit;
            text-rendering: auto;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            padding: 0 5px 0 5px;
        }
        .fas-microphone:before {
            content: "\\f130";
        }
        .microphone-active{
            color: blue;
        }
        .microphone-inactive{
            color: grey;
        }
        .microphone-active:hover{
            cursor: pointer;
        }
        .microphone-inactive:hover{
            cursor: pointer;
        }
        #last-search {
            display: block;
            font-size: 0.8rem;
            height: 1rem;
            padding-top: 5px;
            color: grey;
        }
        #last-search.on {
            visibility: visible;
        }
        #last-search.off {
            visibility: hidden;
        }
    </style>
`;

/**
* @class EkDottInput
* represents a custom web component 
* with the text input and voice recognition
* to search for books within the OpenLibrary.org.
* 
* @params {} none
* @attributes {string} placeholder Placeholder text to be place into the <input>
* @method getData(void): Book[] - accesses the array of fetch data from OpenLibrary API
* @method setQuery(query: string): void - sets the new query to the component
* @method submit(void): void - submits the query to search for the currently set query
*/
class EkDottInput extends HTMLElement {
    //components elements here
    private searchForm: HTMLFormElement | null = null;
    private searchButton: HTMLButtonElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private searchTime: HTMLSpanElement | null = null;

    //Microphone icon and its state for speech recognition
    private microphone: HTMLElement | null = null;
    private microphoneOn: boolean = false;

    //end point for fetching books an its state
    private endPoint: string = "http://openlibrary.org/search.json?q=";
    //whether the reuest is being preformed and the data is loading
    private _loading: boolean = false;

    //data as Book[] which can be at any point accessed by classInstance.getData()
    private _data: Book[] | null = null;
    //timer to update the time ago text
    private _timeAgoTimer: number | null = null;
    //timestamp of the last search
    private _searchTimestamp: number = 0;

    /**
     * Class constructor. Attaches shadow root to where it palces al internal HTML elements.
     *
     * @access public
     * @type    {function}
     */
    constructor() {
        super();
        this.attachShadow({mode: 'open'});

        //defines internal styles and html elements of which this web component is composed
        (<ShadowRoot> this.shadowRoot).innerHTML = `
        ${componentStyles}
        <div id="search-container">
            <form id="search-form">
                <input id="search-input" /><i class="fas fas-microphone microphone-inactive"></i>
                <button id="search-button" type='Submit'>Search</button>
            </form>
            <span id="last-search" class="off"></span>
        </div>
            `;
    }
    /**
     * Web Component lifecycle method where we can initialise certain elements and states.
     *
     * @type    {function}
     * @params {void} 
     * @returns {void}
     */
    connectedCallback(): void {
        this.searchForm = <HTMLFormElement> (<ShadowRoot> this.shadowRoot).querySelector("#search-form");
        this.searchButton = <HTMLButtonElement> (<ShadowRoot> this.shadowRoot).querySelector("#search-button");
        this.searchInput = <HTMLInputElement> (<ShadowRoot> this.shadowRoot).querySelector("#search-input");
        this.searchTime = <HTMLSpanElement> (<ShadowRoot> this.shadowRoot).querySelector("#last-search");
        this.microphone = <HTMLElement> (<ShadowRoot> this.shadowRoot).querySelector(".fas-microphone");

        this.searchForm.addEventListener('submit', this._search.bind(this));
        this.microphone.addEventListener('click', this._toggleMic.bind(this));
        this.searchInput.addEventListener('input', this._inputChange.bind(this));

        //add attributes
        this.searchInput.placeholder = this.getAttribute('placeholder') || "";

        this._inputChange();
    }

    /**
     * Web Component lifecycle method where we can clean up after the component.
     *
     * @type    {function}
     * @params {void} 
     * @returns {void}
     */
    disconnectedCallback(): void {
        //stop anything we can be doing here
        this._toggleMic(); //like speech recognition
        this._timeAgoTimer && clearInterval(this._timeAgoTimer);
    }

    /**
     * Whenever an attribute changes from ouside, we need to reflect that 
     * in the elements which compose our component, in this case HTMLInputElement.
     *
     * @type    {function}
     * @params {string} name    Name of the attribute which changes 
     * @params {string]} oldValue The value this attribute has before the change
     * @params {string]} newValue The value this attribute has after the change
     * @returns {void}
     */
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
        if (name === 'placeholder' && this.searchInput) {
                (<HTMLInputElement> this.searchInput).placeholder = newValue;
        }
    }

    /**
     * Whenever an attribute changes from ouside, we need to tell 
     * which attributes we want to observe for a change.
     *
     * @access static
     * @type    {function}
     * @params {void} 
     * @returns {string[]} Array of attributes as strings which we want to observe for changes
     */
    static get observedAttributes(): string[] {
        //if anybody changes the placeholder from JS, we can observe it
        return ['placeholder'];
    }

    /**
     * This is called in response to submitting the form with the search query.
     * It stops form submission and calls to fetch the data.
     *
     * @access private
     * @type    {function}
     * @params {Event} event object 
     * @returns {void}
     */
    private _search(event?: Event): void {
        event && event.preventDefault();
        this._fetch((<HTMLInputElement> this.searchInput).value)
    }

    /**
     * This connects to the OpenLibrary and fetches the data by the provided search term.
     *
     * @access private
     * @type    {function}
     * @params {string} search term
     * @returns {void} 
     */
    private async _fetch(searchTerm: string): Promise<any> {
        this._loading = true;
        this._data = null;
        try {
            let res: any = await fetch(`${this.endPoint}${searchTerm}`);
            res = await res.json();
            //remapping a bunch of book data into our simple Book type
            this._data = res.docs ? res.docs.map((book: Book) => {
                const {author_name, cover_i, isbn, title, key} = book;
                return {author_name, cover_i, isbn, title, key};
            }) : null;

            this._loading = false;

            //restarting time ago timer
            this._searchTimestamp = new Date().getTime();
            this._timeAgoTimer && clearInterval(this._timeAgoTimer);
            this._timeAgoTimer = setInterval(this._tickLastSearch.bind(this), 1000);

            //enabling text with time after last search
            const {classList} = (<HTMLSpanElement> this.searchTime);
            classList.add("on");
            classList.remove("off");

            //raising event with the data
            this._raiseSearchDone();
        } catch (error) {
            this._loading = false;
            this._data = null;
            //raising eent with the error
            this._raiseSearchError(error);
        }
    }
/**
     * This ticks every second and renders text 
     * how long ago the request has been made
     *
     * @access private
     * @type    {function}
     * @params {void} 
     * @returns {void} 
     */
    _tickLastSearch() {
        (<HTMLSpanElement> this.searchTime).innerText = formatTimeAgo(this._searchTimestamp, navigator.language);
    }
    /**
     * This sets button state enabled or disabled based on the input.
     * if empty the button remains disabled.
     *
     * @access private
     * @type    {function}
     * @params {Event?} Optional Event object
     * @returns {void} 
     */
    private _inputChange(event?: Event) {
        (<HTMLButtonElement> this.searchButton).disabled = ((<HTMLInputElement> this.searchInput).value.length === 0);
    }

    /**
     * This toogles microphone icon classes to indicate active/inactive.
     * if empty the button remains disabled.
     *
     * @access private
     * @type    {function}
     * @params {void} 
     * @returns {void} 
     */
    private _toggleMicIcon() {
        const {classList} = (<HTMLElement> this.microphone);
        classList.toggle("microphone-active");
        classList.toggle("microphone-inactive");
    }

    /**
     * This toogles microphone active/inactive.
     * When active the speech recognition is initialised and listening.
     * When inactive speech recognition is off.
     *
     * @access private
     * @type    {function}
     * @params {void} 
     * @returns {void} 
     */
    private _toggleMic() {
        if (window.hasOwnProperty('webkitSpeechRecognition')) {
            const speech = new(<SpeechWindow> window).webkitSpeechRecognition();
            this._toggleMicIcon();

            const stopSpeech = () => {
                this._toggleMicIcon();
                speech.stop();
                speech.onresult = speech.onerror = null;
            }

            if (this.microphoneOn) {
                //turning off
                stopSpeech();
            } else {
                //turning on
                speech.continuous = false;
                speech.interimResults = false;
                speech.lang = "en-US";
                speech.start();

                speech.onresult = (spoken: any) => {
                        (<HTMLInputElement> this.searchInput).value = spoken.results[0][0].transcript;
                        this._inputChange();
                        stopSpeech();
                        (<HTMLButtonElement> this.searchButton).click();
                };
                speech.onerror = (error: string) => {
                        stopSpeech();
                };
            }
        }
    }

    /**
     * This dispatches a BookEvent with type "searcherror" for which 
     * other HTML components can subscribe with addEventlistener().
     *
     * @access private
     * @type    {function}
     * @params {string} error description
     * @returns {void} 
     */
    private _raiseSearchError(error: string) {
        const event: BookSearchEvent = new Event('searcherror');
        event.error = error;
        this.dispatchEvent(event);
    }

    /**
     * This dispatches a BookEvent with type "searchdone" for which 
     * other HTML components can subscribe with addEventlistener().
     *
     * @access private
     * @type    {function}
     * @params {void}
     * @returns {void} 
     */
    private _raiseSearchDone() {
        const event: BookSearchEvent = new Event('searchdone');
        event.data = this._data ? [...this._data] : []; //copy array for the event receiver
        this.dispatchEvent(event);
    }

    /**
     * This returns the array of data with Book information.
     *
     * @access public
     * @type    {function}
     * @params {void} 
     * @returns {Book[] | null} When assigned returns array of data, ptherwise null
     */
    getData(): Book[] | null {
        return this._data;
    }

    /**
     * This sets the input text from outside.
     * 
     * @access public
     * @type    {function}
     * @params {string} new search term to be put into the HTMLInputElement
     * @returns {void} 
     */
    public setQuery(searchTerm: string = "") {
        (<HTMLInputElement> this.searchInput).value = searchTerm;
        this._inputChange();
    }

    /**
     * This allows programmatically submitting the search query.
     *
     * @access public
     * @type    {function}
     * @params {string} optional search query to be set
     * @returns {void} 
     */
    public submit(searchTerm?: string) {
        searchTerm && this.setQuery(searchTerm);
        this._search();
    }
}

export default EkDottInput;