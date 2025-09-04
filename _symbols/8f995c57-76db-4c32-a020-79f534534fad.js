// New Block - Updated September 4, 2025
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_svg_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, svg_element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[12] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[15] = list[i];
	return child_ctx;
}

// (615:2) {:else}
function create_else_block(ctx) {
	let div2;
	let div1;
	let h1;
	let t0;
	let t1;
	let div0;
	let button0;
	let t2;
	let t3;
	let button1;
	let t4;
	let t5;
	let button2;
	let t6;
	let t7;
	let p;
	let t8;
	let mounted;
	let dispose;

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			h1 = element("h1");
			t0 = text("PUSH PULL LEGS");
			t1 = space();
			div0 = element("div");
			button0 = element("button");
			t2 = text("PUSH");
			t3 = space();
			button1 = element("button");
			t4 = text("PULL");
			t5 = space();
			button2 = element("button");
			t6 = text("LEGS");
			t7 = space();
			p = element("p");
			t8 = text("Select your workout to begin");
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h1 = claim_element(div1_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "PUSH PULL LEGS");
			h1_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t2 = claim_text(button0_nodes, "PUSH");
			button0_nodes.forEach(detach);
			t3 = claim_space(div0_nodes);
			button1 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t4 = claim_text(button1_nodes, "PULL");
			button1_nodes.forEach(detach);
			t5 = claim_space(div0_nodes);
			button2 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button2_nodes = children(button2);
			t6 = claim_text(button2_nodes, "LEGS");
			button2_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t7 = claim_space(div1_nodes);
			p = claim_element(div1_nodes, "P", { class: true });
			var p_nodes = children(p);
			t8 = claim_text(p_nodes, "Select your workout to begin");
			p_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "main-title svelte-12ehuv4");
			attr(button0, "class", "workout-button svelte-12ehuv4");
			attr(button1, "class", "workout-button svelte-12ehuv4");
			attr(button2, "class", "workout-button svelte-12ehuv4");
			attr(div0, "class", "workout-buttons svelte-12ehuv4");
			attr(p, "class", "subtitle svelte-12ehuv4");
			attr(div1, "class", "home-content svelte-12ehuv4");
			attr(div2, "class", "home-view svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, div1);
			append_hydration(div1, h1);
			append_hydration(h1, t0);
			append_hydration(div1, t1);
			append_hydration(div1, div0);
			append_hydration(div0, button0);
			append_hydration(button0, t2);
			append_hydration(div0, t3);
			append_hydration(div0, button1);
			append_hydration(button1, t4);
			append_hydration(div0, t5);
			append_hydration(div0, button2);
			append_hydration(button2, t6);
			append_hydration(div1, t7);
			append_hydration(div1, p);
			append_hydration(p, t8);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[9]),
					listen(button1, "click", /*click_handler_1*/ ctx[10]),
					listen(button2, "click", /*click_handler_2*/ ctx[11])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div2);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (552:2) {#if selectedWorkout && workoutData[selectedWorkout]}
function create_if_block(ctx) {
	let div5;
	let div4;
	let div0;
	let button0;
	let svg0;
	let path0;
	let path1;
	let t0;
	let h1;
	let t1_value = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].name + "";
	let t1;
	let t2;
	let div1;
	let button1;
	let h20;
	let t3;
	let t4;
	let svg1;
	let path2;
	let t5;
	let t6;
	let div3;
	let h21;
	let t7;
	let t8;
	let div2;
	let mounted;
	let dispose;
	let if_block = /*isWarmupExpanded*/ ctx[1] && create_if_block_2(ctx);
	let each_value = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].exercises;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div5 = element("div");
			div4 = element("div");
			div0 = element("div");
			button0 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			t0 = space();
			h1 = element("h1");
			t1 = text(t1_value);
			t2 = space();
			div1 = element("div");
			button1 = element("button");
			h20 = element("h2");
			t3 = text("WARM-UP");
			t4 = space();
			svg1 = svg_element("svg");
			path2 = svg_element("path");
			t5 = space();
			if (if_block) if_block.c();
			t6 = space();
			div3 = element("div");
			h21 = element("h2");
			t7 = text("WORKOUT");
			t8 = space();
			div2 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div5 = claim_element(nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			div4 = claim_element(div5_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			div0 = claim_element(div4_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				class: true,
				viewBox: true,
				fill: true,
				stroke: true,
				"stroke-width": true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true });
			children(path0).forEach(detach);
			path1 = claim_svg_element(svg0_nodes, "path", { d: true });
			children(path1).forEach(detach);
			svg0_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t0 = claim_space(div0_nodes);
			h1 = claim_element(div0_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t1 = claim_text(h1_nodes, t1_value);
			h1_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t2 = claim_space(div4_nodes);
			div1 = claim_element(div4_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			button1 = claim_element(div1_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			h20 = claim_element(button1_nodes, "H2", { class: true });
			var h20_nodes = children(h20);
			t3 = claim_text(h20_nodes, "WARM-UP");
			h20_nodes.forEach(detach);
			t4 = claim_space(button1_nodes);

			svg1 = claim_svg_element(button1_nodes, "svg", {
				class: true,
				viewBox: true,
				fill: true,
				stroke: true,
				"stroke-width": true
			});

			var svg1_nodes = children(svg1);
			path2 = claim_svg_element(svg1_nodes, "path", { d: true });
			children(path2).forEach(detach);
			svg1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			t5 = claim_space(div1_nodes);
			if (if_block) if_block.l(div1_nodes);
			div1_nodes.forEach(detach);
			t6 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			h21 = claim_element(div3_nodes, "H2", { class: true });
			var h21_nodes = children(h21);
			t7 = claim_text(h21_nodes, "WORKOUT");
			h21_nodes.forEach(detach);
			t8 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div2_nodes);
			}

			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M19 12H5");
			attr(path1, "d", "M12 19l-7-7 7-7");
			attr(svg0, "class", "back-icon svelte-12ehuv4");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "fill", "none");
			attr(svg0, "stroke", "currentColor");
			attr(svg0, "stroke-width", "2");
			attr(button0, "class", "back-button svelte-12ehuv4");
			attr(h1, "class", "main-title svelte-12ehuv4");
			attr(div0, "class", "header svelte-12ehuv4");
			attr(h20, "class", "section-title svelte-12ehuv4");
			attr(path2, "d", "M6 9l6 6 6-6");
			attr(svg1, "class", "chevron svelte-12ehuv4");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "fill", "none");
			attr(svg1, "stroke", "currentColor");
			attr(svg1, "stroke-width", "2");
			toggle_class(svg1, "expanded", /*isWarmupExpanded*/ ctx[1]);
			attr(button1, "class", "warmup-toggle svelte-12ehuv4");
			attr(div1, "class", "warmup-section svelte-12ehuv4");
			attr(h21, "class", "section-title svelte-12ehuv4");
			attr(div2, "class", "exercises svelte-12ehuv4");
			attr(div3, "class", "workout-section svelte-12ehuv4");
			attr(div4, "class", "container svelte-12ehuv4");
			attr(div5, "class", "workout-view svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, div5, anchor);
			append_hydration(div5, div4);
			append_hydration(div4, div0);
			append_hydration(div0, button0);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			append_hydration(svg0, path1);
			append_hydration(div0, t0);
			append_hydration(div0, h1);
			append_hydration(h1, t1);
			append_hydration(div4, t2);
			append_hydration(div4, div1);
			append_hydration(div1, button1);
			append_hydration(button1, h20);
			append_hydration(h20, t3);
			append_hydration(button1, t4);
			append_hydration(button1, svg1);
			append_hydration(svg1, path2);
			append_hydration(div1, t5);
			if (if_block) if_block.m(div1, null);
			append_hydration(div4, t6);
			append_hydration(div4, div3);
			append_hydration(div3, h21);
			append_hydration(h21, t7);
			append_hydration(div3, t8);
			append_hydration(div3, div2);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div2, null);
				}
			}

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*backToHome*/ ctx[6]),
					listen(button1, "click", /*toggleWarmup*/ ctx[7])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*selectedWorkout*/ 1 && t1_value !== (t1_value = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].name + "")) set_data(t1, t1_value);

			if (dirty & /*isWarmupExpanded*/ 2) {
				toggle_class(svg1, "expanded", /*isWarmupExpanded*/ ctx[1]);
			}

			if (/*isWarmupExpanded*/ ctx[1]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_2(ctx);
					if_block.c();
					if_block.m(div1, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*workoutData, selectedWorkout, illustrations*/ 25) {
				each_value = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].exercises;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div2, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div5);
			if (if_block) if_block.d();
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (576:10) {#if isWarmupExpanded}
function create_if_block_2(ctx) {
	let div;
	let ul;
	let each_value_1 = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].warmup;
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			ul = claim_element(div_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(ul, "class", "warmup-list svelte-12ehuv4");
			attr(div, "class", "warmup-content svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty & /*workoutData, selectedWorkout*/ 9) {
				each_value_1 = /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]].warmup;
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (579:16) {#each workoutData[selectedWorkout].warmup as item}
function create_each_block_1(ctx) {
	let li;
	let span0;
	let t0;
	let t1;
	let span1;
	let t2_value = /*item*/ ctx[15] + "";
	let t2;
	let t3;

	return {
		c() {
			li = element("li");
			span0 = element("span");
			t0 = text("•");
			t1 = space();
			span1 = element("span");
			t2 = text(t2_value);
			t3 = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			span0 = claim_element(li_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t0 = claim_text(span0_nodes, "•");
			span0_nodes.forEach(detach);
			t1 = claim_space(li_nodes);
			span1 = claim_element(li_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t2 = claim_text(span1_nodes, t2_value);
			span1_nodes.forEach(detach);
			t3 = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "bullet svelte-12ehuv4");
			attr(li, "class", "warmup-item svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, span0);
			append_hydration(span0, t0);
			append_hydration(li, t1);
			append_hydration(li, span1);
			append_hydration(span1, t2);
			append_hydration(li, t3);
		},
		p(ctx, dirty) {
			if (dirty & /*selectedWorkout*/ 1 && t2_value !== (t2_value = /*item*/ ctx[15] + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

// (597:18) {#if exercise.illustration && illustrations[exercise.illustration]}
function create_if_block_1(ctx) {
	let div;
	let raw_value = /*illustrations*/ ctx[4][/*exercise*/ ctx[12].illustration] + "";

	return {
		c() {
			div = element("div");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "illustration svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			div.innerHTML = raw_value;
		},
		p(ctx, dirty) {
			if (dirty & /*selectedWorkout*/ 1 && raw_value !== (raw_value = /*illustrations*/ ctx[4][/*exercise*/ ctx[12].illustration] + "")) div.innerHTML = raw_value;		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (594:12) {#each workoutData[selectedWorkout].exercises as exercise}
function create_each_block(ctx) {
	let div3;
	let div2;
	let t0;
	let div1;
	let h3;
	let t1_value = /*exercise*/ ctx[12].name + "";
	let t1;
	let t2;
	let div0;
	let span0;
	let t3_value = /*exercise*/ ctx[12].sets + "";
	let t3;
	let t4;
	let span1;
	let t5_value = /*exercise*/ ctx[12].reps + "";
	let t5;
	let t6;
	let t7;
	let if_block = /*exercise*/ ctx[12].illustration && /*illustrations*/ ctx[4][/*exercise*/ ctx[12].illustration] && create_if_block_1(ctx);

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			if (if_block) if_block.c();
			t0 = space();
			div1 = element("div");
			h3 = element("h3");
			t1 = text(t1_value);
			t2 = space();
			div0 = element("div");
			span0 = element("span");
			t3 = text(t3_value);
			t4 = text(" sets × ");
			span1 = element("span");
			t5 = text(t5_value);
			t6 = text(" reps");
			t7 = space();
			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			if (if_block) if_block.l(div2_nodes);
			t0 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h3 = claim_element(div1_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t1 = claim_text(h3_nodes, t1_value);
			h3_nodes.forEach(detach);
			t2 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			span0 = claim_element(div0_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t3 = claim_text(span0_nodes, t3_value);
			span0_nodes.forEach(detach);
			t4 = claim_text(div0_nodes, " sets × ");
			span1 = claim_element(div0_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t5 = claim_text(span1_nodes, t5_value);
			span1_nodes.forEach(detach);
			t6 = claim_text(div0_nodes, " reps");
			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t7 = claim_space(div3_nodes);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h3, "class", "exercise-title svelte-12ehuv4");
			attr(span0, "class", "sets svelte-12ehuv4");
			attr(span1, "class", "reps svelte-12ehuv4");
			attr(div0, "class", "exercise-sets svelte-12ehuv4");
			attr(div1, "class", "exercise-info svelte-12ehuv4");
			attr(div2, "class", "exercise-content svelte-12ehuv4");
			attr(div3, "class", "exercise-card svelte-12ehuv4");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, div2);
			if (if_block) if_block.m(div2, null);
			append_hydration(div2, t0);
			append_hydration(div2, div1);
			append_hydration(div1, h3);
			append_hydration(h3, t1);
			append_hydration(div1, t2);
			append_hydration(div1, div0);
			append_hydration(div0, span0);
			append_hydration(span0, t3);
			append_hydration(div0, t4);
			append_hydration(div0, span1);
			append_hydration(span1, t5);
			append_hydration(div0, t6);
			append_hydration(div3, t7);
		},
		p(ctx, dirty) {
			if (/*exercise*/ ctx[12].illustration && /*illustrations*/ ctx[4][/*exercise*/ ctx[12].illustration]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					if_block.m(div2, t0);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*selectedWorkout*/ 1 && t1_value !== (t1_value = /*exercise*/ ctx[12].name + "")) set_data(t1, t1_value);
			if (dirty & /*selectedWorkout*/ 1 && t3_value !== (t3_value = /*exercise*/ ctx[12].sets + "")) set_data(t3, t3_value);
			if (dirty & /*selectedWorkout*/ 1 && t5_value !== (t5_value = /*exercise*/ ctx[12].reps + "")) set_data(t5, t5_value);
		},
		d(detaching) {
			if (detaching) detach(div3);
			if (if_block) if_block.d();
		}
	};
}

function create_fragment(ctx) {
	let div;

	function select_block_type(ctx, dirty) {
		if (/*selectedWorkout*/ ctx[0] && /*workoutData*/ ctx[3][/*selectedWorkout*/ ctx[0]]) return create_if_block;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div = element("div");
			if_block.c();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			if_block.l(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "app svelte-12ehuv4");
			toggle_class(div, "fade-in", /*fadeIn*/ ctx[2]);
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div, null);
				}
			}

			if (dirty & /*fadeIn*/ 4) {
				toggle_class(div, "fade-in", /*fadeIn*/ ctx[2]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			if_block.d();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;

	// Exercise interface
	const workoutData = {
		push: {
			name: "PUSH DAY",
			warmup: [
				"5 minutes light cardio",
				"Arm circles (10 each direction)",
				"Shoulder rolls (10 each direction)",
				"Push-up position holds (3x15 seconds)",
				"Band pull-aparts (2x15)"
			],
			exercises: [
				{
					name: "Barbell Bench Press",
					sets: "4",
					reps: "5-8",
					illustration: "bench-press"
				},
				{
					name: "Overhead Press",
					sets: "3",
					reps: "6-8",
					illustration: "overhead-press"
				},
				{
					name: "Incline Dumbbell Press",
					sets: "3",
					reps: "8-10",
					illustration: "bench-press"
				},
				{
					name: "Dips",
					sets: "3",
					reps: "8-12",
					illustration: "overhead-press"
				},
				{
					name: "Lateral Raises",
					sets: "3",
					reps: "12-15",
					illustration: "overhead-press"
				},
				{
					name: "Tricep Pushdowns",
					sets: "3",
					reps: "10-12",
					illustration: "overhead-press"
				}
			]
		},
		pull: {
			name: "PULL DAY",
			warmup: [
				"5 minutes light cardio",
				"Arm swings (10 each direction)",
				"Band pull-aparts (2x15)",
				"Dead hangs (3x20 seconds)",
				"Scapular retractions (2x12)"
			],
			exercises: [
				{
					name: "Pull-ups",
					sets: "4",
					reps: "5-8",
					illustration: "pull-ups"
				},
				{
					name: "Barbell Rows",
					sets: "4",
					reps: "6-8",
					illustration: "pull-ups"
				},
				{
					name: "Lat Pulldowns",
					sets: "3",
					reps: "8-10",
					illustration: "pull-ups"
				},
				{
					name: "Cable Rows",
					sets: "3",
					reps: "10-12",
					illustration: "pull-ups"
				},
				{
					name: "Face Pulls",
					sets: "3",
					reps: "12-15",
					illustration: "pull-ups"
				},
				{
					name: "Barbell Curls",
					sets: "3",
					reps: "10-12",
					illustration: "pull-ups"
				}
			]
		},
		legs: {
			name: "LEGS DAY",
			warmup: [
				"5 minutes light cardio",
				"Leg swings (10 each direction)",
				"Hip circles (10 each direction)",
				"Bodyweight squats (2x10)",
				"Walking lunges (2x10 each leg)"
			],
			exercises: [
				{
					name: "Barbell Back Squats",
					sets: "4",
					reps: "5-8",
					illustration: "squats"
				},
				{
					name: "Romanian Deadlifts",
					sets: "3",
					reps: "6-8",
					illustration: "squats"
				},
				{
					name: "Bulgarian Split Squats",
					sets: "3",
					reps: "8-10 each leg",
					illustration: "squats"
				},
				{
					name: "Leg Press",
					sets: "3",
					reps: "12-15",
					illustration: "squats"
				},
				{
					name: "Walking Lunges",
					sets: "3",
					reps: "10-12 each leg",
					illustration: "squats"
				},
				{
					name: "Calf Raises",
					sets: "4",
					reps: "15-20",
					illustration: "squats"
				}
			]
		}
	};

	// SVG illustrations
	const illustrations = {
		"bench-press": `<svg viewBox="0 0 100 80" class="exercise-svg">
      <rect x="20" y="35" width="60" height="3" fill="currentColor"/>
      <rect x="15" y="30" width="10" height="15" fill="currentColor"/>
      <rect x="75" y="30" width="10" height="15" fill="currentColor"/>
      <ellipse cx="50" cy="25" rx="8" ry="6" fill="currentColor"/>
      <rect x="42" y="30" width="16" height="20" fill="currentColor"/>
      <rect x="35" y="45" width="10" height="3" fill="currentColor"/>
      <rect x="55" y="45" width="10" height="3" fill="currentColor"/>
      <rect x="38" y="48" width="4" height="12" fill="currentColor"/>
      <rect x="58" y="48" width="4" height="12" fill="currentColor"/>
      <text x="50" y="70" text-anchor="middle" class="exercise-label">BENCH PRESS</text>
    </svg>`,
		"overhead-press": `<svg viewBox="0 0 100 80" class="exercise-svg">
      <ellipse cx="50" cy="20" rx="6" ry="5" fill="currentColor"/>
      <rect x="45" y="25" width="10" height="25" fill="currentColor"/>
      <rect x="35" y="30" width="8" height="3" fill="currentColor"/>
      <rect x="57" y="30" width="8" height="3" fill="currentColor"/>
      <rect x="40" y="15" width="20" height="3" fill="currentColor"/>
      <circle cx="35" cy="16" r="2" fill="currentColor"/>
      <circle cx="65" cy="16" r="2" fill="currentColor"/>
      <rect x="47" y="50" width="6" height="15" fill="currentColor"/>
      <rect x="40" y="62" width="8" height="3" fill="currentColor"/>
      <rect x="52" y="62" width="8" height="3" fill="currentColor"/>
      <text x="50" y="75" text-anchor="middle" class="exercise-label">OVERHEAD PRESS</text>
    </svg>`,
		"pull-ups": `<svg viewBox="0 0 100 80" class="exercise-svg">
      <rect x="20" y="15" width="60" height="3" fill="currentColor"/>
      <rect x="48" y="18" width="4" height="10" fill="currentColor"/>
      <ellipse cx="50" cy="32" rx="6" ry="5" fill="currentColor"/>
      <rect x="45" y="37" width="10" height="20" fill="currentColor"/>
      <rect x="35" y="42" width="8" height="3" fill="currentColor"/>
      <rect x="57" y="42" width="8" height="3" fill="currentColor"/>
      <rect x="47" y="57" width="6" height="12" fill="currentColor"/>
      <rect x="40" y="66" width="8" height="3" fill="currentColor"/>
      <rect x="52" y="66" width="8" height="3" fill="currentColor"/>
      <text x="50" y="75" text-anchor="middle" class="exercise-label">PULL-UPS</text>
    </svg>`,
		"squats": `<svg viewBox="0 0 100 80" class="exercise-svg">
      <ellipse cx="50" cy="20" rx="6" ry="5" fill="currentColor"/>
      <rect x="45" y="25" width="10" height="15" fill="currentColor"/>
      <rect x="35" y="32" width="8" height="3" fill="currentColor"/>
      <rect x="57" y="32" width="8" height="3" fill="currentColor"/>
      <rect x="40" y="40" width="6" height="15" fill="currentColor"/>
      <rect x="54" y="40" width="6" height="15" fill="currentColor"/>
      <rect x="35" y="50" width="8" height="3" fill="currentColor"/>
      <rect x="57" y="50" width="8" height="3" fill="currentColor"/>
      <rect x="38" y="53" width="10" height="3" fill="currentColor"/>
      <rect x="52" y="53" width="10" height="3" fill="currentColor"/>
      <text x="50" y="70" text-anchor="middle" class="exercise-label">SQUATS</text>
    </svg>`
	};

	let selectedWorkout = null;
	let isWarmupExpanded = false;
	let fadeIn = false;

	onMount(() => {
		$$invalidate(2, fadeIn = true);
	});

	function selectWorkout(workoutType) {
		$$invalidate(0, selectedWorkout = workoutType);
		$$invalidate(1, isWarmupExpanded = false);
	}

	function backToHome() {
		$$invalidate(0, selectedWorkout = null);
	}

	function toggleWarmup() {
		$$invalidate(1, isWarmupExpanded = !isWarmupExpanded);
	}

	const click_handler = () => selectWorkout('push');
	const click_handler_1 = () => selectWorkout('pull');
	const click_handler_2 = () => selectWorkout('legs');

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(8, props = $$props.props);
	};

	return [
		selectedWorkout,
		isWarmupExpanded,
		fadeIn,
		workoutData,
		illustrations,
		selectWorkout,
		backToHome,
		toggleWarmup,
		props,
		click_handler,
		click_handler_1,
		click_handler_2
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 8 });
	}
}

export { Component as default };
