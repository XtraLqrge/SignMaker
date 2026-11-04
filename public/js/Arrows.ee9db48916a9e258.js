
class Arrow {
constructor({
arrowType = "",
leftText = "",
rightText = "",
individual = true,
parentIndex = 0,
arrowIndex = 0
} = {}
) {
this.arrowType = arrowType;
this.lefttext = leftText;
this.rightText = rightText;
this.individual = individual;
this.parentIndex = parentIndex;
this.arrowIndex = arrowIndex;
}
}
Arrow.prototype.arrows = [
"Slighter Left:H-1",
"Slighter Right:H-2",
"Slight Left:F-1",
"Slight Right:F-2",
"Full Left:I-1",
"Full Right:I-2",
"Straight and Left:G-1",
"Straight at Right:G-2",
"Straight:J-1",
"Down:J-2"
]
