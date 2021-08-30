
/* -----------------------------------------------
/* Author : Jef Packer  - jefpacker.ai
/* Apache license: https://www.apache.org/licenses/LICENSE-2.0.html
/* Github : github.com/jbpacker/paths
/* ----------------------------------------------- */

// Where curvature is 1/R (R is radius of turn) and dist is the arc length traveled.
function stepCurv(p, curvature, dist) {
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

function curvToPoint(p, target) {
    var s = Math.sin(p.yaw);
    var c = Math.cos(p.yaw);

    var dx_global = (target.x - p.x);
    var dy_global = (target.y - p.y);

    var dx = dx_global * c + dy_global * s;
    var dy = -dx_global * s + dy_global * c;

    var curv = (2 * dy) / (dx * dx + dy * dy);
    return curv;
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

        let new_position = stepCurv(this.parent.position, this.curvature, this.distance)

        this.child = new Node(this.parent, this, new_position)
    }

    singleDraw() {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.moveTo(this.parent.position.x, this.parent.position.y);
        var p = this.parent.position;
        var i = 0;
        var ds = 1.0
        while (i < this.distance) {
            i += ds
            p = stepCurv(p, this.curvature, ds);
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.child.position.x, this.child.position.y)
        ctx.stroke();        }

    draw() {
        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(this.parent.position.x, this.parent.position.y);
        var p = this.parent.position;
        var i = 0;
        var ds = 1.0
        while (i < this.distance) {
            i += ds
            p = stepCurv(p, this.curvature, ds);
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.child.position.x, this.child.position.y)
        ctx.stroke();
        this.child.draw()
    }
}

class Node {
    constructor(parent, branch, position) {
        this.parent = parent;
        this.branch = branch;
        this.position = position;
        this.children = [];

        this.curvature = (Math.random() * 2 * curvature_sample) - (curvature_sample);
        this.distance = Math.random() * distance_sample + distance_sample_offset;
    }

    sample() {
        let b = new Branch(this, this.curvature, this.distance);
        this.children.push(b);
        return b;
    }

    drawFromChild() {
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
        // ctx.fillRect(
        //     this.position.x - 2,
        //     this.position.y - 2,
        //     4,
        //     4);
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

    containsParent(target_node, up) {
        if (this == target_node) {
            return true;
        }
        if (up == 0 || this.parent == null) {
            return false;
        }
        return this.parent.containsParent(target_node, up - 1);
    }
}

const sleepNow = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

class Tree {
    constructor(start, target) {
        this.root = new Node(null, null, start)
        this.node_queue = []
        this.node_queue.push(this.root)
        this.running = false
        this.closest_node = this.root
        this.target = target
    }

    async rollout() {
        this.running = true

        while (this.node_queue.length > 0) {
            let node = this.node_queue.shift();
            var branch = node.sample();

            var dist_to_closest_node = this.closest_node.distanceTo(this.target.position)
            var dist_to_child = branch.child.distanceTo(this.target.position)

            if (dist_to_child < dist_to_closest_node) {
                this.closest_node = branch.child
                this.node_queue.push(branch.child)
            } else if (dist_to_child < dist_to_closest_node + explore_distance) {
                this.node_queue.push(branch.child)
            }

            if (node.distanceTo(this.target.position) < dist_to_closest_node + explore_distance) {
                this.node_queue.push(node)
            }

            if (dist_to_child < finish_distance && !this.target.circle) {
                this.running = false
                return;
            }

            // Cleanup
            // var super_parent = this.closest_node.getParent(draw_depth)
            // chopTrunk(super_parent);

            await sleepNow(search_sleep_time);

            // Add root back in just in case the queue goes empty
            if (this.node_queue.length == 0) {
                this.node_queue.push(this.root)
                this.closest_node = this.root
            }
        }
    }

    chopTrunk(trunk_node) {
        if (trunk_node.parent) {
            this.root = trunk_node.parent;
            this.prune(this.root);
            this.root.parent = null;
        }
    }

    // Checks that "root" node is within "up" distance of all nodes in node_queue
    prune(target_node) {
        let new_node_queue = [];
        while (this.node_queue.length > 0) {
            var node = this.node_queue.shift()
            if (node.containsParent(target_node, draw_depth)) {
                new_node_queue.push(node)
            }
        }
        this.node_queue = [...new_node_queue];
    }

    async update() {
        if (this.running == false) {
            this.rollout()
        }
    }

    draw() {
        this.root.draw()
        this.closest_node.drawFromChild()
    }
}

class Robot {
    constructor(start, tree) {
        this.position = start;
        this.tree = tree;
        this.target_node = this.tree.root;
        this.moving = false;
        this.path = [];
    }

    constructPath() {
        var node = this.tree.closest_node;
        this.path = [];
        while (node != this.target_node) {
            this.path.push(node);
            if (node.parent) {
                node = node.parent;
            } else {
                break;
            }
        }
    }

    async move() {
        while (this.moving) {
            this.constructPath();

            // Bump up the node once the current one is complete
            if (this.atTargetNode() && this.path.length > 0) {
                this.target_node = this.path.pop()
                this.tree.prune(this.target_node)
                this.tree.chopTrunk(this.target_node)
                // this.tree.root = this.target_node
            }

            var dist = robot_step;
            if (this.atTargetNode() && this.path.length == 0) {
                // set dist to 0, so robot doesn't move forward.
                dist = 0.0;
                // In circle mode we want to continue running.
                if (!this.tree.target.circle) {
                    this.moving = false;
                    return;
                }
            }

            // Find curvature to the next node and step the robot forward.
            var curv = curvToPoint(this.position, this.target_node.position);
            this.position = stepCurv(this.position, curv, dist);

            await sleepNow(robot_sleep_time);
        }
    }

    atTargetNode() {
        return distance(this.target_node.position, this.position) < finish_move_distance;
    }

    needToMove() {
        return this.tree.closest_node != this.target_node;
    }

    update() {
        if (!this.moving && this.tree.running && this.needToMove()) {
            this.moving = true;
            this.move();
        }
    }

    draw() {
        // Robot Path
        // for (let i = 0; i < this.path.length; i++) {
        //     if (!this.path[i]) {
        //         break;
        //     }

        //     if (this.path[i].branch && this.path[i].parent) {
        //         this.path[i].branch.singleDraw()
        //     }
        // }

        // Terrible js system for rotating things
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.position.yaw + (0.25*Math.PI));
        ctx.drawImage(rocket, -rocket_length*0.5, -rocket_length*0.5, rocket_length, rocket_length)
        ctx.rotate(-(this.position.yaw + (0.25*Math.PI)));
        ctx.translate(-this.position.x, -this.position.y);

        // Dot on target node
        // ctx.fillRect(
        //     this.target_node.position.x - 5,
        //     this.target_node.position.y - 5,
        //     10,
        //     10);

    }
}

class Target {
    constructor() {
        this.position = new Position(0.0, 0.0, 0.0);
        this.circle = true;
        this.theta = planet_start_theta;
        this.phi = 0.0;
    }

    clickUpdate(position) {
        this.position = position
        this.circle = false
    }

    async update() {
        while (this.circle) {
            // 360 steps per circle
            this.theta = this.theta + planet_step_size;
            this.position.x = 0.5 * canvas.width + 0.5 * planet_percent_circle * canvas.width * Math.sin(this.theta);
            this.position.y = 0.5 * canvas.height + 0.5 * planet_percent_circle * canvas.height * Math.cos(this.theta);
            await sleepNow(robot_sleep_time);
        }
    }

    draw() {
        // Terrible js system for rotating things
        this.phi = this.phi + planet_spin_step
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.phi);
        ctx.drawImage(
            planet, 
            -planet_length*0.5, 
            -planet_length*0.5, 
            planet_length, 
            planet_length)
        ctx.rotate(-this.phi);
        ctx.translate(-this.position.x, -this.position.y);
    }
}

// Search + Motion Parameters

// planet circle percent of screen
var planet_percent_circle = 0.6;

// planet rad per step
var planet_step_size = Math.PI / 500;
var planet_spin_step = Math.PI / 500;

var planet_start_theta = 1/8 * Math.PI;

// Curvature sample = [+/-]rand[0-1] * curvature_sample
var curvature_sample = 0.02;

// Sample distance = rand[0-1] * distance_sample + distance_sample_offset
var distance_sample = 40;
var distance_sample_offset = 45;

// Will continue expanding node if within this distance from target of closest node
var explore_distance = 75;

// Stops searching when within this distance of target
var finish_distance = 40;

// Draws this many nodes up from node that's closest to target
var draw_depth = 30;

// Break time between cycles [ms]
var search_sleep_time = 80;
var draw_sleep_time = 50;
var robot_sleep_time = 40;

var finish_move_distance = 5;

var robot_length = 40;
var robot_width = 18;
var robot_step = 2;
var rocket_length = 40;

var planet_length = 40;

let rocket = new Image();
rocket.src = 'https://uploads-ssl.webflow.com/612292ecc8ee4caae75526b9/612472e781d6bd721466ce5d_rocket.svg';

let planet = new Image();
planet.src = 'https://uploads-ssl.webflow.com/612292ecc8ee4caae75526b9/612c501335b1fd3fcf3657d8_planet.png'

// Search start position
let start_position = new Position(
    0.5 * window.innerWidth,
    window.innerHeight - rocket_length,
    3/2 * Math.PI);

let target = new Target();
let tree = new Tree(start_position, target);
let robot = new Robot(start_position, tree);
var canvas, ctx;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function init() {
    canvas = document.getElementById('rrt');
    resizeCanvas();
    ctx = canvas.getContext("2d");

    canvas.addEventListener("click", function (e) {
        updatePosition(e)
    }, false);
    window.addEventListener("resize", resizeCanvas, false);

    draw();

    target.update();
    tree.update();
    robot.update();
}

async function draw() {
    if (true) {
    // if (robot.moving || tree.running) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        target.draw();
        tree.draw();
        robot.draw();
    }
    await sleepNow(draw_sleep_time)
    requestAnimationFrame(draw);
}

function updatePosition(e) {
    let target_position = new Position(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    target.clickUpdate(target_position)
    tree.update()
    robot.update()
}
