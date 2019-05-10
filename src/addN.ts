/**
 * This is higher prder function
 *  which creates functions to whcih a specific number can be added
 *
 * @access public
 * @type  {function}
 * @params {number} NUmber from which to create a closure in the returned fucntion.
 * @returns {function(x:number) => number} 
 */
const addN: (x: number) => (y:number) => number = (x:number) => (y:number) => x+y;
export default addN