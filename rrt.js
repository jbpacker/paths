
/* -----------------------------------------------
/* Author : Jef Packer  - jefpacker.ai
/* Apache license: https://www.apache.org/licenses/LICENSE-2.0.html
/* Github : github.com/jbpacker/paths
/* ----------------------------------------------- */

function sleep(milliseconds) {  
    return new Promise(resolve => setTimeout(resolve, milliseconds));  
}  
// file:///Users/jef/paths/page.html

// Where curvature is 1/R of the turn and dist is the arc length traveled.
function stepCurv3(p, curvature, dist) {
    var dx_local = dist;
    var dy_local = 0.0;
    var theta = 0.0;
    if (Math.abs(curvature) > 0.0001) {
        var R = 1 / curvature;
        theta = dist * curvature;
        dx_local = R * Math.sin(theta);
        dy_local = R * (1 - Math.cos(theta));
    }
    var c = Math.cos(-p.yaw);
    var s = Math.sin(-p.yaw);

    var x = dx_local * c + dy_local * s + p.x;  
    var y = -dx_local * s + dy_local * c + p.y;
    var yaw = p.yaw + theta;

    let new_p = new Position(x, y, yaw);
    return new_p;
}

function stepRad(p, angle, dist) {
    var dx = dist * Math.sin(angle);
    var dy = dist * Math.cos(angle);
    let new_p = new Position(p.x + dx, p.y + dy, angle);
    return new_p;
}

function distance(p, target) {
    var dx = target.x - p.x;
    var dy = target.y - p.y;
    var out = Math.sqrt(dx * dx + dy * dy);
    return out;
}

class Position {
    constructor(x, y, yaw) {
        this.x = x;
        this.y = y;
        this.yaw = yaw;
    }
}

class Branch {
    constructor(parent, curvature, distance) {
        this.parent = parent;
        this.curvature = curvature;
        this.distance = distance;

        let new_position = stepCurv3(this.parent.position, this.curvature, this.distance)

        this.child = new Node(this.parent, this, new_position)
    }

    singleDraw() {
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(this.parent.position.x, this.parent.position.y);
        var p = this.parent.position;
        var i = 0;
        var ds = 1.0
        while (i < this.distance) {
            i += ds
            p = stepCurv3(p, this.curvature, ds);
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.child.position.x, this.child.position.y)
        ctx.stroke();        }

    draw() {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(this.parent.position.x, this.parent.position.y);
        var p = this.parent.position;
        var i = 0;
        var ds = 1.0
        while (i < this.distance) {
            i += ds
            p = stepCurv3(p, this.curvature, ds);
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.child.position.x, this.child.position.y)
        ctx.stroke();
        this.child.draw()
    }
}

class Node {
    constructor(parent, branch, position) {
        this.parent = parent
        this.branch = branch
        this.position = position
        this.children = []

        this.curvature = (Math.random() * 0.2) - (0.1)
        // this.curvature = -0.1

        this.distance = Math.random() * 10 + 5;
        // this.distance = 40
    }

    sample() {
        let b = new Branch(this, this.curvature, this.distance);
        this.children.push(b);
        return b;
    }

    drawFromChild() {
        // ctx.strokeStyle = 'green';
        // ctx.lineWidth = 1;

        // ctx.beginPath();
        // ctx.moveTo(this.position.x, this.position.y)
        // ctx.lineTo(
        //     this.position.x + 8 * Math.cos(this.position.yaw), 
        //     this.position.y + 8 * Math.sin(this.position.yaw)
        // );
        // ctx.stroke()
        // ctx.fillRect(this.position.x, this.position.y, 5, 5);
        if (this.branch) {
            this.branch.singleDraw()
        }
        if (this.parent) {
            this.parent.drawFromChild()
        }
    }

    draw() {
        for (const b in this.children) {
            this.children[b].draw()
        }
    }

    getParent(up) {
        if (up == 0) {
            return this;
        }

        if (this.parent == null) {
            return null;
        }

        return this.parent.getParent(up - 1);
    }

    distanceTo(target) {
        return distance(this.position, target)
    }
}

const sleepNow = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

class Tree {
    constructor(start) {
        this.root = new Node(null, null, start)
        this.node_queue = []
        this.node_queue.push(this.root)
        this.running = false
        this.closest_node = this.root
    }

    async rollout() {
        this.running = true

        while (this.node_queue.length > 0) {
            let node = this.node_queue.shift();
            var branch = node.sample();

            var dist_to_closest_node = this.closest_node.distanceTo(this.target)
            var dist_to_child = branch.child.distanceTo(this.target)

            // console.log("closest dist: " + dist_to_closest_node + " child dist: " + dist_to_child + " explore_distance: " + ((dist_to_closest_node * 1.02) - dist_to_closest_node))

            if (dist_to_child < dist_to_closest_node) {
                this.closest_node = branch.child
                this.node_queue.push(branch.child)
            } else if (dist_to_child < dist_to_closest_node + explore_distance) {
                this.node_queue.push(branch.child)
            }

            if (node.distanceTo(this.target) < dist_to_closest_node + explore_distance) {
                this.node_queue.push(node)
            }

            if (dist_to_child < finish_distance) {
                this.running = false
                return;
            }

            // Cleanup
            var super_parent = this.closest_node.getParent(draw_depth)
            if (super_parent) {
                this.root = super_parent;
                if (this.root.parent) {
                    this.root.parent = null;
                }
            }

            await sleepNow(search_sleep_time);

            // Add root back in just in case the queue goes empty
            if (this.node_queue.length == 0) {
                this.node_queue.push(this.root)
            }
        }
    }


    async update(target) {
        this.target = target
        if (this.running == false) {
            this.rollout()
        }
    }

    draw() {
        if (this.running) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.closest_node.drawFromChild()
            this.root.draw()
        }
    }
}

var explore_distance = 15;
var finish_distance = 30;
var draw_sleep_time = 10;
var draw_depth = 100;
var search_sleep_time = 1;
let start_position = new Position(50, 200, 0)

let tree = new Tree(start_position);

// Position root;
var canvas, ctx, flag = false,
    dot_flag = false;

function init() {
    canvas = document.getElementById('can');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");

    canvas.addEventListener("mousemove", function (e) {
        updatePosition(e)
    }, false);

    draw();
}

async function draw() {
    tree.draw();
    await sleepNow(draw_sleep_time)
    requestAnimationFrame(draw);
}

function updatePosition(e) {
    let target = new Position(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop)
    tree.update(target)
}