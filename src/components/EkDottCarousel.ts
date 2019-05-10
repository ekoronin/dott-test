import {Book} from '../types';

enum AnimationState {
    Playing,
    Paused,
    Stopped
}

const componentStyles = `
        <style>
        :host {
            font-family: sans-serif;
            border: 2px solid purple;
            padding: 1rem;
            margin: 1rem;
            display: block;
            width: auto;
        }
        #list {
            padding: 0px;
            margin: 0px;
            width: 150%;
            display: flex;
            flex-wrap: nowrap;
        }
        #carousel {
            max-height: 600px;
            overflow: hidden;
        }
        #list li {
            margin-top: 0px;
            margin-left: 0px;
            list-style: none;
            overflow:hidden;
        }
        @media screen and (max-width: 1500px) {
            #list li {
                height: 600px;
            }
            .cover {
                height: 450px; 
            }
            .title-author {
                font-size: 1rem;
            } 
        }
        @media screen and (max-width: 1000px) {
            #list li {
                height: 350px;
            }
            .cover {
                height: 300px;
            }
            .title-author {
                font-size: 0.7rem;
            } 
        }
        @media screen and (max-width: 500px) {
            #list li {
                height: 150px;
            }
            .cover {
                height: 100px;
            }
            .title-author {
                font-size: 0.5rem;
            } 
        }
        .cover {
            align-self: center;
            width: auto;
            max-width: 90%;
        }
        .title-author {
            font-family: sans-serif;
            color: purple;
            font-weight: 500;
            height: 50px;
            padding-top: 10px;
        }
        .cell {
            display: flex;
            justify-content: space-between;
            flex-direction: column;
            text-align: center;
            align-items: center;
        }
        </style>
`;

/**
* @class EkDottCarousel
*
* Represents a custom web component 
* with scrolling cells whcih display book cover and author/title.
* 
* @params {} none
* @attributes {string} items Number o items visible at one time in the carousel
* @attributes {string} stub-image A URL of a blank image in case the book ite has no valid cover
* @method setFeed(data:Book[], autostart:boolean):void  Sets the data feed for the carousel with an Book[]
* @method start():void Starts scrolling the carousel
* @method stop():void  Stops  scrolling the carousel
* @method pause():void Pauses scrolling the carousel
*/
class EkDottCarousel extends HTMLElement {
    //default image URL if non available
    static DEFAULT_IMAGE: string = "https://dummyimage.com/180x250/7f007f/eeeeee.png&text=no+cover";
    //Main UL list which holds the items
    private carouselList: HTMLUListElement | null = null;
    //array of data from where teh book info is rendered
    private _data: Book[] | null = null;
    //number of items in the carousel visible at one time
    private _numberItems: number = 0;
    //pointer into the data array as the carousel scrolls
    private _dataCursor: number = 0;
    //this holds html template for rendering the book info
    private _cellTemplate: string = '';
    //carousel animation state
    private _carouselState: AnimationState = AnimationState.Stopped;
    //Browser Animatin object to control the animation: play/pause/stop
    private _animation: Animation | null = null;
    //calculated width for each rendered item as provided in the attribute "items"
    private _itemWidth: number = 0;
    //stub image url which is provided in the attribute "stub-image"
    private _stubImageUrl: string = "";
    /**
     * Class constructor. Attaches shadow root to where it palces al internal HTML elements.
     *
     * @access public
     * @type  {function}
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        //defines internal styles and html elements of which this web component is composed
        (<ShadowRoot> this.shadowRoot).innerHTML = `
        ${componentStyles}
        <div id="carousel">
            <ul id="list">
            </ul>
        </div>
        `;

        this._cellTemplate = `
            <div class="cell">
                <a href="$$key" target="_blank">
                    <img class="cover" src="$$image"/>
                </a>
                <span class="title-author">$$author</span>
            </div>
        `;
    }

    /**
     * Web Component lifecycle method where we can initialise certain elements and states.
     *
     * @type  {function}
     * @params {void} 
     * @returns {void}
     */
    connectedCallback(): void {
        this.carouselList = <HTMLUListElement> (<ShadowRoot> this.shadowRoot).querySelector("#list");
        this.carouselList.addEventListener('mouseover', this.pause.bind(this));
        this.carouselList.addEventListener('mouseout', this.start.bind(this));
        // Handle page visibility change  - this time only for Chrome
        document.addEventListener('visibilitychange', this._visibilityChange.bind(this), false);
        //init list items with 3 by default or from attributes
        //add attributes
        this._numberItems = parseInt(this.getAttribute('items') || "3", 10);
        this._stubImageUrl = this.getAttribute('stub-image') || ""
        this._createList();
    }

    /**
   * Whenever an attribute changes from ouside, we need to reflect that 
   * in the elements which compose our component, in this case HTMLInputElement.
   *
   * @type  {function}
   * @params {string} name  Name of the attribute which changes 
   * @params {string]} oldValue The value this attribute has before the change
   * @params {string]} newValue The value this attribute has after the change
   * @returns {void}
   */
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
        if (name === 'stub-image') {
            this._stubImageUrl = newValue;
        } else
        if (name === 'items' && this.carouselList) {
            this._numberItems = parseInt(newValue, 10);
            const carouselState = this._carouselState;
            //this will change the state
            this.stop();
            //re-create layout
            this._createList();
            this._fillList();

            switch (carouselState) {
                case AnimationState.Playing: {
                    this.start();
                    break;
                }
                case AnimationState.Paused: {
                    this.start();
                    this.pause();
                    break;
                }
                case AnimationState.Stopped: 
                default: break;
            }
        }
    }

    /**
     * Whenever an attribute changes from ouside, we need to tell 
     * which attributes we want to observe for a change.
     *
     * @access static
     * @type  {function}
     * @params {void} 
     * @returns {string[]} Array of attributes as strings which we want to observe for changes
     */
    static get observedAttributes(): string[] {
        //if anybody changes the placeholder from JS, we can observe it
        return ['items', 'stub-image'];
    }

    /**
     * Whenever the page is put in the background, we need to pause the carousel.
     * 
     * @access private
     * @type  {function}
     * @params {void} 
     */
    private _visibilityChange() {
        if (document.hidden) {
            this.pause();
        } else {
            this.start();
        }
    }
 
    /**
     * Creates a number of empty LI elements for the carousel.
     * 
     * @access private
     * @type  {function}
     * @params {void} 
     */
    private _createList() {
        //clear potentially stale items
        (<HTMLUListElement> this.carouselList).innerHTML = "";
        this._itemWidth = Math.round((<HTMLUListElement> this.carouselList).clientWidth / this._numberItems);
        //add numberItems+2 li elements to ul to have 2 buffer elements offscreen
        Array(this._numberItems + 2).fill(0).map(() => {
            const li: HTMLLIElement = document.createElement('li');
            li.style.setProperty('width', `${this._itemWidth}px`);
            (<HTMLUListElement> this.carouselList).appendChild(li);
        });

        //adjust width in % for UL list so taht only numberOfItems were on screen
        //and the other 2 background cells were off.
        (<HTMLUListElement> this.carouselList).style.setProperty('width', `${Math.floor(100*(this._numberItems+2)/this._numberItems)}%`);
    }

    /**
     * Calculates what the book cover URl should be 
     * from provided CoverID or ISBN,
     * if non available it uses stub URL from attributes.
     * 
     * @access private
     * @type  {function}
     * @params {Book} Book item
     * @return {string} Book cover URL
     */
    private _composeImageUrl(book: Book): string {
        //check viewport size here and construct the image url
        const coverPath: string = 'http://covers.openlibrary.org/b/';
        const {clientWidth} = document.documentElement; //viewport width
        const sizeSuffix: string = clientWidth <500 ? "S" : (clientWidth <1080) ? "M" : "L";

        //only searching for cover_i and isbn covers for simplicity
        //not found cover will deliver blank image 1x1
        let imgUrl: string = "";
        const {cover_i, isbn} = book;
        if (typeof cover_i !== "undefined") {
            imgUrl = `${coverPath}id/${cover_i}-${sizeSuffix}.jpg`;
        } else 
        if (typeof isbn !== "undefined" && (<Array <string>> isbn).length> 0) {
            imgUrl = `${coverPath}isbn/${(<Array<string>>isbn)[0]}-${sizeSuffix}.jpg?default=false`;
        } else 
        if (this._stubImageUrl !== "") {
            imgUrl = this._stubImageUrl;
        } else {
            imgUrl = EkDottCarousel.DEFAULT_IMAGE; //fall back to a dummy image
        }
        return imgUrl;
    };

    /**
     * Renders content of one cell in the list.
     * 
     * @access private
     * @type  {function}
     * @params {Book} Book item 
     * @return {string} HTML representation of the DOM content
      */
    private _fillItem(item: Book): string {
        const {author_name, title, key} = item;
        return this._cellTemplate
        .replace('$$key', `https://openlibrary.org${key || ""}`)
        .replace('$$image', this._composeImageUrl(item))
        .replace('$$author', `${title} by ${author_name || ""}`);
    }

    /**
     * If the server responds wtih 404 for the book cover.
     * We can catch onerror of the <img> element 
     * and place stub URL in it.
     * 
     * @access private
     * @type  {function}
     * @params {HTMLLIElement} The <li> element where the image is located 
     */
    private _fixImageUrl(li: HTMLLIElement) {
        //need to handle a case where URL appears valid but OpenLibrary responds wtih 404
        const image: HTMLImageElement = <HTMLImageElement> li.querySelector('img');
        const stubImg = this._stubImageUrl;
        image.onerror = function() {
            //we need this = image here
            this.src = stubImg || EkDottCarousel.DEFAULT_IMAGE;
        }
    }
    
    /**
     * Fills the list with the information from the provided data.
     * 
     * @access private
     * @type  {function}
     * @params {void}
     */
    private _fillList() {
        const liArray: NodeListOf <HTMLLIElement> = (<ShadowRoot> this.shadowRoot).querySelectorAll("li");
        liArray.forEach((li, ind) => {
            //what if we have empty array or 2 items only and 4 LI elements?
            if (ind <(<Book[]> this._data).length) {
                li.innerHTML = this._fillItem((<Book[]> this._data)[ind]);
                this._fixImageUrl(li);
            }
        });
        this._dataCursor = liArray.length;
    }

    /**
     * When the carousel has scrolled one item offscreen.
     * This adds new <li> at the end of the existing <li>.
     * 
     * @access private
     * @type  {function}
     * @params {void}
     */
    private _addNewItem() {
        if (this._carouselState === AnimationState.Playing) {
            this._dataCursor = ++this._dataCursor % (<Book[]> this._data).length;
            const child = (<HTMLUListElement> this.carouselList).firstElementChild;
            if (child) {
                //remove first UL child  = LI and add another one LI at the end
                const li = document.createElement('li');
                li.style.setProperty('width', `${this._itemWidth}px`);
                (<HTMLUListElement> this.carouselList).removeChild(child);
                li.innerHTML = this._fillItem((<Book[]> this._data)[this._dataCursor]);
                this._fixImageUrl(li);
                (<HTMLUListElement> this.carouselList).appendChild(li);

                this._advance(); // start next animation frame
            }
        }
    }

    /**
     * Starts moving next animation slide.
     * onFinish of the Animation we add a new <li> to the end and restart the sequence.
     * 
     * @access private
     * @type  {function}
     * @params {void}
     */
    private _advance() {
        if (this._carouselState === AnimationState.Playing) {
            const {clientWidth} = <HTMLLIElement> (<HTMLUListElement> this.carouselList).firstElementChild;
            const aniStyle = [
                {
                    transform: 'translateX(0px)'
                },
                {
                    transform: `translateX(${-clientWidth}px)`
                }
            ];
            const aniTiming: KeyframeAnimationOptions = {
                duration: 3000,
                iterations: 1,
                fill: 'forwards'
            };
            this._animation = (<HTMLUListElement> this.carouselList).animate(aniStyle, aniTiming);
            this._animation.onfinish = this._addNewItem.bind(this);
        }
    }

    /**
     * Sets the carousel data to be the provided array of Book[].
     * Fills the earlier created <li> elements with data from an html template. 
     * 
     * @access public
     * @type  {function}
     * @params {Book[]} Array of data to be used by teh carousel
     * @params {autostart?} Optional boolean , true=start carousel 
     */
    public setFeed(data: Book[] = [], autostart?: boolean) {
        this._data = data;
        this._createList();
        this._fillList();
        autostart && this.start();
    }

    /**
     * Starts scrolling the carousel.
     * 
     * @access public
     * @type  {function}
     * @params {void}
     */
    public start() {
        //let's chec if we can start animating = have data and enough itms
        if (this._data && this._data.length> this._numberItems) {
            if (this._carouselState === AnimationState.Paused) {
                this._carouselState = AnimationState.Playing;
                this._resume();
            } else 
            if (this._carouselState === AnimationState.Stopped) {
                this._carouselState = AnimationState.Playing;
                this._advance();
            }
        }
    }

    /**
     * Stops scrolling the carousel.
     * 
     * @access public
     * @type  {function}
     * @params {void}
     */
    public stop() {
        if (this._carouselState === AnimationState.Playing) {
            this._carouselState = AnimationState.Stopped;
            (<Animation> this._animation).onfinish = null;
            (<Animation> this._animation).finish();
        }
    }

    /**
     * Pauses scrolling the carousel.
     * 
     * @access public
     * @type  {function}
     * @params {void}
     */
    public pause() {
        if (this._carouselState === AnimationState.Playing) {
            this._carouselState = AnimationState.Paused;
            (<Animation> this._animation).pause();
        }
    }

    /**
     * Resumes scrolling the carousel from paused state.
     * 
     * @access private
     * @type  {function}
     * @params {void}
     */
    private _resume() {
        this._carouselState = AnimationState.Playing;
        (<Animation> this._animation).play();
    }

}

export default EkDottCarousel;