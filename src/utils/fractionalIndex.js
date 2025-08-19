import Big from "big.js";

export function fractionalBetween(left, right) {
	let result;
	if (left != null && right != null) {
		const leftBig = new Big(left);
		const rightBig = new Big(right);
		result = leftBig.plus(rightBig).div(2);
	} else if (left == null && right != null) {
		result = new Big(right).minus(1);
	} else if (left != null && right == null) {
		result = new Big(left).plus(1);
	} else {
		result = new Big(0);
	}
	
	// Return as a Big.js object which Mendix can handle properly
	return result;
}


