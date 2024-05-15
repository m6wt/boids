const visualRange = 50 
const avoidFactor = 0.5 
const minSpeed = 0.1
const maxSpeed = 2 
const alignmentFactor = 0.095
const cohesionFactor = 0.095
const collisionAvoidFactor = 0.095

let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}   


function drawBoid(object) {
    ctx.save()                          
    ctx.translate(object.x, object.y)

    if (object.type === 'object') {
        ctx.beginPath()
        ctx.moveTo(object.radius, 0)
        for (let i = 1; i < object.sides; i++) {            
            const angle = (Math.PI * 2 * i) / object.sides
            const x = object.radius * Math.cos(angle)
            const y = object.radius * Math.sin(angle)
            ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = 'black'
        ctx.fill()
    } else {
        let angle = Math.atan2(object.vy, object.vx)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(15, 5)
        ctx.lineTo(15, -5)
        ctx.fillStyle = 'lightgray'
        ctx.fill()
        ctx.closePath()
    }

    ctx.restore();
}


function animate(objects) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let boid of flock) {
        let neighbors = []
        for (let otherBoid of flock) {
            if (boid !== otherBoid && distance(boid.x, boid.y, otherBoid.x, otherBoid.y) < visualRange) {
                neighbors.push(otherBoid)
            }
        } 
        boid.update(neighbors, objects)

        drawBoid(boid)
    }

    for (let object of objects) {
        drawBoid(object)
    }

    requestAnimationFrame(() => animate(objects))
}


class QuadTree {
    constructor(bounds, capacity) {
        this.bounds = bounds
        this.capacity = capacity
        this.objects = []
        this.children = []
    }

    insert(object) {
        if (!this.children.length) {
            this.objects.push(object)
            if (this.objects.length > this.capacity && this.bounds.width > 1 && this.bounds.height > 1) {
                this.subdivide()
                for (let obj of this.objects) {
                    this.insert(obj)
                }
                this.objects = []
            }
        } else {
            let index = this.getIndex(object)
            if (index !== -1) {
                this.children[index].insert(object)
            } else {
                this.objects.push(object)
            }

        }
    }

    subdivide() {
        let x = this.bounds.x
        let y = this.bounds.y
        let width = this.bounds.width / 2
        let height = this.bounds.height / 2

        this.children.push(new QuadTree({ x: x + width, y: y, width: width, height: height }, this.capacity))
        this.children.push(new QuadTree({ x: x, y: y, width: width, height: height }, this.capacity))
        this.children.push(new QuadTree({ x: x, y: y + height, width: width, height: height }, this.capacity))
        this.children.push(new QuadTree({ x: x + width, y: y + height, width: width, height: height }, this.capacity))
    }

    getIndex(object) {
        let verticalMidpoint = this.bounds.x + this.bounds.width / 2
        let horizontalMidpoint = this.bounds.y + this.bounds.height / 2

        let topQuadrant = (object.y < horizontalMidpoint && object.y + object.radius < horizontalMidpoint)
        let bottomQuadrant = (object.y > horizontalMidpoint)

        if (object.x < verticalMidpoint && object.x + object.radius < verticalMidpoint) {
            if (topQuadrant) {
                return 1
            } else if (bottomQuadrant) {
                return 2
            }
        } else if (object.x > verticalMidpoint) {
            if (topQuadrant) {
                return 0
            } else if (bottomQuadrant) {
                return 3
            }

        }
        return -1 
    }

    retrieve(object) {
        let index = this.getIndex(object)
        let foundObjects = this.objects

        if (this.children.length) {
            if (index!== -1) {
                foundObjects = foundObjects.concat(this.children[index].retrieve(object))
            } else {
                for (let child of this.children) {
                    foundObjects = foundObjects.concat(child.retrieve(object))
                }
            }
        }
        return foundObjects
    }
}

class Object {
    constructor(x, y, vx, vy, radius) {
        this.x = x
        this.y = y
        this.vx = vx
        this.vy = vy
        this.radius = radius
        this.type = 'object'
        this.sides = Math.floor(Math.random() * 7) + 3
    }

    collide(otherObject) {
        const dx = otherObject.x - this.x
        const dy = otherObject.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < this.radius + otherObject.radius
    }

}

class Boid {
    constructor(x, y, vx, vy, biasVal) {
        this.x = x
        this.y = y
        this.vx = vx
        this.vy = vy
        this.biasVal = biasVal
    }

    cohesion(neighbors) {
        if (neighbors.length === 0) 
            return {x: 0, y: 0}

        let avgX = 0
        let avgY = 0

        for (let neighbor of neighbors) {
            avgX += neighbor.x
            avgY += neighbor.y
        }

        avgX /= neighbors.length
        avgY /= neighbors.length

        return {x: avgX - this.x, y: avgY - this.y}
    }

    alignment(neighbors){
        if (neighbors.length === 0) 
            return {x: 0, y: 0}

        let avgX = 0
        let avgY = 0

        for (let neighbor of neighbors) {
            avgX += neighbor.vx
            avgY += neighbor.vy
        }

        avgX /= neighbors.length
        avgY /= neighbors.length

        return {x: avgX - this.vx, y: avgY - this.vy}
    }

    separation(neighbors){
        let separationX = 0
        let separationY = 0

        for (let neighbor of neighbors) {
            let dx = neighbor.x - this.x
            let dy = neighbor.y - this.y
            let distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 0) {
                separationX -= dx / distance
                separationY -= dy / distance
            }
        }
        return {x: separationX, y: separationY}
    }

    objectAvoidance(objects) {
        let avoidX = 0
        let avoidY = 0

        for (let object of objects) {
            const dx = object.x - this.x
            const dy = object.y - this.y
            const distance = Math.sqrt(dx * dx + dy * dy)
        

            if (distance < visualRange) {
                avoidX -= dx / (distance * distance)
                avoidY -= dy / (distance * distance)
            }
        }

        if (avoidX === 0 && avoidY === 0) {
            return {x: 0, y: 0}
        }

        const avoidMagnitude = Math.sqrt(avoidX * avoidX + avoidY * avoidY)
        avoidX /= avoidMagnitude
        avoidY /= avoidMagnitude
        
        return {x: avoidX, y: avoidY}
    }
    update(neighbors, objects) {
        let cohesionVector = this.cohesion(neighbors)
        let alignmentVector = this.alignment(neighbors)
        let separationVector = this.separation(neighbors)
        let objectAvoidVector = this.objectAvoidance(objects)

        let collisionVector = {x: 0, y: 0}
        
        for (let object of objects) {
            const dx = object.x - this.x
            const dy = object.y - this.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < visualRange) {
                collisionVector.x -= dx / distance
                collisionVector.y -= dy / distance
            }
        }

        this.vx += cohesionVector.x * cohesionFactor + alignmentVector.x * alignmentFactor + separationVector.x * avoidFactor + objectAvoidVector.x * avoidFactor + collisionVector.x * collisionAvoidFactor
        this.vy += cohesionVector.y * cohesionFactor + alignmentVector.y * alignmentFactor + separationVector.y * avoidFactor + objectAvoidVector.y * avoidFactor + collisionVector.y * collisionAvoidFactor

        let speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed
            this.vy = (this.vy / speed) * maxSpeed
        }

        this.x += this.vx
        this.y += this.vy

        if (this.x < 0) this.x = canvas.width
        if (this.x > canvas.width) this.x = 0
        if (this.y < 0) this.y = canvas.height
        if (this.y > canvas.height) this.y = 0
    }
}

// Initialize boids
let flock = [];
for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const vx = Math.random() * 2 - 1;
    const vy = Math.random() * 2 - 1;

    flock.push(new Boid(x, y, vx, vy, Math.random()));
}

// Initialize objects
let objects = []
for (let i = 0; i < 20; i++) {
    const type = Math.random() < 0.5 ? 'boid' : 'object';
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const vx = Math.random() * 2 - 1;
    const vy = Math.random() * 2 - 1;
    const radius = Math.random() * 10 + 5;

    objects.push(new Object(x, y, vx, vy, radius));
}

// Start animation
animate(objects);
