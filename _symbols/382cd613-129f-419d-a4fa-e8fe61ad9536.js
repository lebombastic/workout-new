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
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
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

let current_component;
function set_current_component(component) {
    current_component = component;
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
	child_ctx[15] = list[i];
	child_ctx[17] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

// (646:2) {:else}
function create_else_block(ctx) {
	let div4;
	let button;
	let t0;
	let t1;
	let h1;
	let t2_value = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].title + "";
	let t2;
	let t3;
	let div1;
	let h20;
	let t4;
	let t5;
	let div0;
	let t6;
	let div3;
	let h21;
	let t7;
	let t8;
	let div2;
	let mounted;
	let dispose;
	let each_value_1 = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].warmup;
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	let each_value = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].exercises;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div4 = element("div");
			button = element("button");
			t0 = text("←");
			t1 = space();
			h1 = element("h1");
			t2 = text(t2_value);
			t3 = space();
			div1 = element("div");
			h20 = element("h2");
			t4 = text("🔥 Warm-up");
			t5 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t6 = space();
			div3 = element("div");
			h21 = element("h2");
			t7 = text("💪 Main Exercises");
			t8 = space();
			div2 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div4 = claim_element(nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			button = claim_element(div4_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t0 = claim_text(button_nodes, "←");
			button_nodes.forEach(detach);
			t1 = claim_space(div4_nodes);
			h1 = claim_element(div4_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t2 = claim_text(h1_nodes, t2_value);
			h1_nodes.forEach(detach);
			t3 = claim_space(div4_nodes);
			div1 = claim_element(div4_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h20 = claim_element(div1_nodes, "H2", { class: true });
			var h20_nodes = children(h20);
			t4 = claim_text(h20_nodes, "🔥 Warm-up");
			h20_nodes.forEach(detach);
			t5 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].l(div0_nodes);
			}

			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t6 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			h21 = claim_element(div3_nodes, "H2", { class: true });
			var h21_nodes = children(h21);
			t7 = claim_text(h21_nodes, "💪 Main Exercises");
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
			this.h();
		},
		h() {
			attr(button, "class", "back-btn svelte-1rtnrbu");
			attr(h1, "class", "svelte-1rtnrbu");
			attr(h20, "class", "svelte-1rtnrbu");
			attr(div0, "class", "warmup-list svelte-1rtnrbu");
			attr(div1, "class", "workout-section svelte-1rtnrbu");
			attr(h21, "class", "svelte-1rtnrbu");
			attr(div2, "class", "exercises-list svelte-1rtnrbu");
			attr(div3, "class", "workout-section svelte-1rtnrbu");
			attr(div4, "class", "workout-view svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div4, anchor);
			append_hydration(div4, button);
			append_hydration(button, t0);
			append_hydration(div4, t1);
			append_hydration(div4, h1);
			append_hydration(h1, t2);
			append_hydration(div4, t3);
			append_hydration(div4, div1);
			append_hydration(div1, h20);
			append_hydration(h20, t4);
			append_hydration(div1, t5);
			append_hydration(div1, div0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				if (each_blocks_1[i]) {
					each_blocks_1[i].m(div0, null);
				}
			}

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
				dispose = listen(button, "click", /*goBack*/ ctx[5]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*currentView*/ 1 && t2_value !== (t2_value = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].title + "")) set_data(t2, t2_value);

			if (dirty & /*workouts, currentView*/ 9) {
				each_value_1 = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].warmup;
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_1(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(div0, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_1.length;
			}

			if (dirty & /*viewGif, workouts, currentView*/ 73) {
				each_value = /*workouts*/ ctx[3][/*currentView*/ ctx[0]].exercises;
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
			if (detaching) detach(div4);
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

// (621:2) {#if currentView === 'main'}
function create_if_block_1(ctx) {
	let div1;
	let h1;
	let t0;
	let t1;
	let p;
	let t2;
	let t3;
	let div0;
	let button0;
	let span0;
	let t4;
	let t5;
	let span1;
	let t6;
	let t7;
	let span2;
	let t8;
	let t9;
	let button1;
	let span3;
	let t10;
	let t11;
	let span4;
	let t12;
	let t13;
	let span5;
	let t14;
	let t15;
	let button2;
	let span6;
	let t16;
	let t17;
	let span7;
	let t18;
	let t19;
	let span8;
	let t20;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			h1 = element("h1");
			t0 = text("Strength Training");
			t1 = space();
			p = element("p");
			t2 = text("Choose your workout split");
			t3 = space();
			div0 = element("div");
			button0 = element("button");
			span0 = element("span");
			t4 = text("💪");
			t5 = space();
			span1 = element("span");
			t6 = text("Push");
			t7 = space();
			span2 = element("span");
			t8 = text("Chest, Shoulders, Triceps");
			t9 = space();
			button1 = element("button");
			span3 = element("span");
			t10 = text("🏋️");
			t11 = space();
			span4 = element("span");
			t12 = text("Pull");
			t13 = space();
			span5 = element("span");
			t14 = text("Back, Biceps");
			t15 = space();
			button2 = element("button");
			span6 = element("span");
			t16 = text("🦵");
			t17 = space();
			span7 = element("span");
			t18 = text("Legs");
			t19 = space();
			span8 = element("span");
			t20 = text("Quads, Hamstrings, Glutes");
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h1 = claim_element(div1_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Strength Training");
			h1_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			p = claim_element(div1_nodes, "P", { class: true });
			var p_nodes = children(p);
			t2 = claim_text(p_nodes, "Choose your workout split");
			p_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			span0 = claim_element(button0_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t4 = claim_text(span0_nodes, "💪");
			span0_nodes.forEach(detach);
			t5 = claim_space(button0_nodes);
			span1 = claim_element(button0_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t6 = claim_text(span1_nodes, "Push");
			span1_nodes.forEach(detach);
			t7 = claim_space(button0_nodes);
			span2 = claim_element(button0_nodes, "SPAN", { class: true });
			var span2_nodes = children(span2);
			t8 = claim_text(span2_nodes, "Chest, Shoulders, Triceps");
			span2_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t9 = claim_space(div0_nodes);
			button1 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			span3 = claim_element(button1_nodes, "SPAN", { class: true });
			var span3_nodes = children(span3);
			t10 = claim_text(span3_nodes, "🏋️");
			span3_nodes.forEach(detach);
			t11 = claim_space(button1_nodes);
			span4 = claim_element(button1_nodes, "SPAN", { class: true });
			var span4_nodes = children(span4);
			t12 = claim_text(span4_nodes, "Pull");
			span4_nodes.forEach(detach);
			t13 = claim_space(button1_nodes);
			span5 = claim_element(button1_nodes, "SPAN", { class: true });
			var span5_nodes = children(span5);
			t14 = claim_text(span5_nodes, "Back, Biceps");
			span5_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			t15 = claim_space(div0_nodes);
			button2 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button2_nodes = children(button2);
			span6 = claim_element(button2_nodes, "SPAN", { class: true });
			var span6_nodes = children(span6);
			t16 = claim_text(span6_nodes, "🦵");
			span6_nodes.forEach(detach);
			t17 = claim_space(button2_nodes);
			span7 = claim_element(button2_nodes, "SPAN", { class: true });
			var span7_nodes = children(span7);
			t18 = claim_text(span7_nodes, "Legs");
			span7_nodes.forEach(detach);
			t19 = claim_space(button2_nodes);
			span8 = claim_element(button2_nodes, "SPAN", { class: true });
			var span8_nodes = children(span8);
			t20 = claim_text(span8_nodes, "Quads, Hamstrings, Glutes");
			span8_nodes.forEach(detach);
			button2_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "svelte-1rtnrbu");
			attr(p, "class", "subtitle svelte-1rtnrbu");
			attr(span0, "class", "btn-icon svelte-1rtnrbu");
			attr(span1, "class", "btn-text svelte-1rtnrbu");
			attr(span2, "class", "btn-desc svelte-1rtnrbu");
			attr(button0, "class", "workout-btn push-btn svelte-1rtnrbu");
			attr(span3, "class", "btn-icon svelte-1rtnrbu");
			attr(span4, "class", "btn-text svelte-1rtnrbu");
			attr(span5, "class", "btn-desc svelte-1rtnrbu");
			attr(button1, "class", "workout-btn pull-btn svelte-1rtnrbu");
			attr(span6, "class", "btn-icon svelte-1rtnrbu");
			attr(span7, "class", "btn-text svelte-1rtnrbu");
			attr(span8, "class", "btn-desc svelte-1rtnrbu");
			attr(button2, "class", "workout-btn legs-btn svelte-1rtnrbu");
			attr(div0, "class", "button-container svelte-1rtnrbu");
			attr(div1, "class", "main-view svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, h1);
			append_hydration(h1, t0);
			append_hydration(div1, t1);
			append_hydration(div1, p);
			append_hydration(p, t2);
			append_hydration(div1, t3);
			append_hydration(div1, div0);
			append_hydration(div0, button0);
			append_hydration(button0, span0);
			append_hydration(span0, t4);
			append_hydration(button0, t5);
			append_hydration(button0, span1);
			append_hydration(span1, t6);
			append_hydration(button0, t7);
			append_hydration(button0, span2);
			append_hydration(span2, t8);
			append_hydration(div0, t9);
			append_hydration(div0, button1);
			append_hydration(button1, span3);
			append_hydration(span3, t10);
			append_hydration(button1, t11);
			append_hydration(button1, span4);
			append_hydration(span4, t12);
			append_hydration(button1, t13);
			append_hydration(button1, span5);
			append_hydration(span5, t14);
			append_hydration(div0, t15);
			append_hydration(div0, button2);
			append_hydration(button2, span6);
			append_hydration(span6, t16);
			append_hydration(button2, t17);
			append_hydration(button2, span7);
			append_hydration(span7, t18);
			append_hydration(button2, t19);
			append_hydration(button2, span8);
			append_hydration(span8, t20);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[11]),
					listen(button1, "click", /*click_handler_1*/ ctx[12]),
					listen(button2, "click", /*click_handler_2*/ ctx[13])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div1);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (657:10) {#each workouts[currentView].warmup as warmupExercise}
function create_each_block_1(ctx) {
	let div;
	let span0;
	let t0_value = /*warmupExercise*/ ctx[18].name + "";
	let t0;
	let t1;
	let span1;
	let t2_value = /*warmupExercise*/ ctx[18].duration + "";
	let t2;
	let t3;

	return {
		c() {
			div = element("div");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			t2 = text(t2_value);
			t3 = space();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			span0 = claim_element(div_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t0 = claim_text(span0_nodes, t0_value);
			span0_nodes.forEach(detach);
			t1 = claim_space(div_nodes);
			span1 = claim_element(div_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t2 = claim_text(span1_nodes, t2_value);
			span1_nodes.forEach(detach);
			t3 = claim_space(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "exercise-name svelte-1rtnrbu");
			attr(span1, "class", "exercise-duration svelte-1rtnrbu");
			attr(div, "class", "warmup-item svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, span0);
			append_hydration(span0, t0);
			append_hydration(div, t1);
			append_hydration(div, span1);
			append_hydration(span1, t2);
			append_hydration(div, t3);
		},
		p(ctx, dirty) {
			if (dirty & /*currentView*/ 1 && t0_value !== (t0_value = /*warmupExercise*/ ctx[18].name + "")) set_data(t0, t0_value);
			if (dirty & /*currentView*/ 1 && t2_value !== (t2_value = /*warmupExercise*/ ctx[18].duration + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (669:10) {#each workouts[currentView].exercises as exercise, index}
function create_each_block(ctx) {
	let div6;
	let div0;
	let t0_value = /*index*/ ctx[17] + 1 + "";
	let t0;
	let t1;
	let div5;
	let div4;
	let h3;
	let t2_value = /*exercise*/ ctx[15].name + "";
	let t2;
	let t3;
	let div3;
	let div1;
	let span0;
	let t4;
	let t5;
	let span1;
	let t6_value = /*exercise*/ ctx[15].sets + "";
	let t6;
	let t7;
	let div2;
	let span2;
	let t8;
	let t9;
	let span3;
	let t10_value = /*exercise*/ ctx[15].rest + "";
	let t10;
	let t11;
	let button;
	let t12;
	let t13;
	let mounted;
	let dispose;

	function click_handler_3() {
		return /*click_handler_3*/ ctx[14](/*exercise*/ ctx[15]);
	}

	return {
		c() {
			div6 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div5 = element("div");
			div4 = element("div");
			h3 = element("h3");
			t2 = text(t2_value);
			t3 = space();
			div3 = element("div");
			div1 = element("div");
			span0 = element("span");
			t4 = text("Sets & Reps:");
			t5 = space();
			span1 = element("span");
			t6 = text(t6_value);
			t7 = space();
			div2 = element("div");
			span2 = element("span");
			t8 = text("Rest:");
			t9 = space();
			span3 = element("span");
			t10 = text(t10_value);
			t11 = space();
			button = element("button");
			t12 = text("View Workout GIF");
			t13 = space();
			this.h();
		},
		l(nodes) {
			div6 = claim_element(nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			div0 = claim_element(div6_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			t0 = claim_text(div0_nodes, t0_value);
			div0_nodes.forEach(detach);
			t1 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			div4 = claim_element(div5_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			h3 = claim_element(div4_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t2 = claim_text(h3_nodes, t2_value);
			h3_nodes.forEach(detach);
			t3 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div1 = claim_element(div3_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			span0 = claim_element(div1_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t4 = claim_text(span0_nodes, "Sets & Reps:");
			span0_nodes.forEach(detach);
			t5 = claim_space(div1_nodes);
			span1 = claim_element(div1_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t6 = claim_text(span1_nodes, t6_value);
			span1_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t7 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			span2 = claim_element(div2_nodes, "SPAN", { class: true });
			var span2_nodes = children(span2);
			t8 = claim_text(span2_nodes, "Rest:");
			span2_nodes.forEach(detach);
			t9 = claim_space(div2_nodes);
			span3 = claim_element(div2_nodes, "SPAN", { class: true });
			var span3_nodes = children(span3);
			t10 = claim_text(span3_nodes, t10_value);
			span3_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t11 = claim_space(div5_nodes);
			button = claim_element(div5_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t12 = claim_text(button_nodes, "View Workout GIF");
			button_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			t13 = claim_space(div6_nodes);
			div6_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "exercise-number svelte-1rtnrbu");
			attr(h3, "class", "exercise-name svelte-1rtnrbu");
			attr(span0, "class", "detail-label svelte-1rtnrbu");
			attr(span1, "class", "detail-value svelte-1rtnrbu");
			attr(div1, "class", "detail-item svelte-1rtnrbu");
			attr(span2, "class", "detail-label svelte-1rtnrbu");
			attr(span3, "class", "detail-value svelte-1rtnrbu");
			attr(div2, "class", "detail-item svelte-1rtnrbu");
			attr(div3, "class", "exercise-details svelte-1rtnrbu");
			attr(div4, "class", "exercise-info svelte-1rtnrbu");
			attr(button, "class", "gif-btn");
			attr(div5, "class", "exercise-content svelte-1rtnrbu");
			attr(div6, "class", "exercise-card svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div6, anchor);
			append_hydration(div6, div0);
			append_hydration(div0, t0);
			append_hydration(div6, t1);
			append_hydration(div6, div5);
			append_hydration(div5, div4);
			append_hydration(div4, h3);
			append_hydration(h3, t2);
			append_hydration(div4, t3);
			append_hydration(div4, div3);
			append_hydration(div3, div1);
			append_hydration(div1, span0);
			append_hydration(span0, t4);
			append_hydration(div1, t5);
			append_hydration(div1, span1);
			append_hydration(span1, t6);
			append_hydration(div3, t7);
			append_hydration(div3, div2);
			append_hydration(div2, span2);
			append_hydration(span2, t8);
			append_hydration(div2, t9);
			append_hydration(div2, span3);
			append_hydration(span3, t10);
			append_hydration(div5, t11);
			append_hydration(div5, button);
			append_hydration(button, t12);
			append_hydration(div6, t13);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_3);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*currentView*/ 1 && t2_value !== (t2_value = /*exercise*/ ctx[15].name + "")) set_data(t2, t2_value);
			if (dirty & /*currentView*/ 1 && t6_value !== (t6_value = /*exercise*/ ctx[15].sets + "")) set_data(t6, t6_value);
			if (dirty & /*currentView*/ 1 && t10_value !== (t10_value = /*exercise*/ ctx[15].rest + "")) set_data(t10, t10_value);
		},
		d(detaching) {
			if (detaching) detach(div6);
			mounted = false;
			dispose();
		}
	};
}

// (703:2) {#if showGifModal && currentGif}
function create_if_block(ctx) {
	let div3;
	let div2;
	let button;
	let t0;
	let t1;
	let h3;
	let t2_value = /*currentGif*/ ctx[2].name + "";
	let t2;
	let t3;
	let div0;
	let img;
	let img_src_value;
	let img_alt_value;
	let t4;
	let div1;
	let p0;
	let strong0;
	let t5;
	let t6;
	let t7_value = /*currentGif*/ ctx[2].sets + "";
	let t7;
	let t8;
	let p1;
	let strong1;
	let t9;
	let t10;
	let t11_value = /*currentGif*/ ctx[2].rest + "";
	let t11;
	let mounted;
	let dispose;

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			button = element("button");
			t0 = text("×");
			t1 = space();
			h3 = element("h3");
			t2 = text(t2_value);
			t3 = space();
			div0 = element("div");
			img = element("img");
			t4 = space();
			div1 = element("div");
			p0 = element("p");
			strong0 = element("strong");
			t5 = text("Sets & Reps:");
			t6 = space();
			t7 = text(t7_value);
			t8 = space();
			p1 = element("p");
			strong1 = element("strong");
			t9 = text("Rest:");
			t10 = space();
			t11 = text(t11_value);
			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			button = claim_element(div2_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t0 = claim_text(button_nodes, "×");
			button_nodes.forEach(detach);
			t1 = claim_space(div2_nodes);
			h3 = claim_element(div2_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t2 = claim_text(h3_nodes, t2_value);
			h3_nodes.forEach(detach);
			t3 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			img = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			p0 = claim_element(div1_nodes, "P", { class: true });
			var p0_nodes = children(p0);
			strong0 = claim_element(p0_nodes, "STRONG", { class: true });
			var strong0_nodes = children(strong0);
			t5 = claim_text(strong0_nodes, "Sets & Reps:");
			strong0_nodes.forEach(detach);
			t6 = claim_space(p0_nodes);
			t7 = claim_text(p0_nodes, t7_value);
			p0_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);
			p1 = claim_element(div1_nodes, "P", { class: true });
			var p1_nodes = children(p1);
			strong1 = claim_element(p1_nodes, "STRONG", { class: true });
			var strong1_nodes = children(strong1);
			t9 = claim_text(strong1_nodes, "Rest:");
			strong1_nodes.forEach(detach);
			t10 = claim_space(p1_nodes);
			t11 = claim_text(p1_nodes, t11_value);
			p1_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "class", "modal-close svelte-1rtnrbu");
			attr(h3, "class", "modal-title svelte-1rtnrbu");
			if (!src_url_equal(img.src, img_src_value = /*currentGif*/ ctx[2].gifUrl)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = "" + (/*currentGif*/ ctx[2].name + " demonstration"));
			attr(img, "class", "exercise-gif svelte-1rtnrbu");
			attr(div0, "class", "gif-container svelte-1rtnrbu");
			attr(strong0, "class", "svelte-1rtnrbu");
			attr(p0, "class", "svelte-1rtnrbu");
			attr(strong1, "class", "svelte-1rtnrbu");
			attr(p1, "class", "svelte-1rtnrbu");
			attr(div1, "class", "modal-exercise-info svelte-1rtnrbu");
			attr(div2, "class", "modal-content svelte-1rtnrbu");
			attr(div3, "class", "modal-overlay svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, div2);
			append_hydration(div2, button);
			append_hydration(button, t0);
			append_hydration(div2, t1);
			append_hydration(div2, h3);
			append_hydration(h3, t2);
			append_hydration(div2, t3);
			append_hydration(div2, div0);
			append_hydration(div0, img);
			append_hydration(div2, t4);
			append_hydration(div2, div1);
			append_hydration(div1, p0);
			append_hydration(p0, strong0);
			append_hydration(strong0, t5);
			append_hydration(p0, t6);
			append_hydration(p0, t7);
			append_hydration(div1, t8);
			append_hydration(div1, p1);
			append_hydration(p1, strong1);
			append_hydration(strong1, t9);
			append_hydration(p1, t10);
			append_hydration(p1, t11);

			if (!mounted) {
				dispose = [
					listen(button, "click", /*closeGifModal*/ ctx[7]),
					listen(div3, "click", /*handleModalClick*/ ctx[8]),
					listen(div3, "keydown", /*handleKeydown*/ ctx[9])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*currentGif*/ 4 && t2_value !== (t2_value = /*currentGif*/ ctx[2].name + "")) set_data(t2, t2_value);

			if (dirty & /*currentGif*/ 4 && !src_url_equal(img.src, img_src_value = /*currentGif*/ ctx[2].gifUrl)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*currentGif*/ 4 && img_alt_value !== (img_alt_value = "" + (/*currentGif*/ ctx[2].name + " demonstration"))) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty & /*currentGif*/ 4 && t7_value !== (t7_value = /*currentGif*/ ctx[2].sets + "")) set_data(t7, t7_value);
			if (dirty & /*currentGif*/ 4 && t11_value !== (t11_value = /*currentGif*/ ctx[2].rest + "")) set_data(t11, t11_value);
		},
		d(detaching) {
			if (detaching) detach(div3);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment(ctx) {
	let div;
	let t;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*currentView*/ ctx[0] === 'main') return create_if_block_1;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*showGifModal*/ ctx[1] && /*currentGif*/ ctx[2] && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			if_block0.c();
			t = space();
			if (if_block1) if_block1.c();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			if_block0.l(div_nodes);
			t = claim_space(div_nodes);
			if (if_block1) if_block1.l(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "app svelte-1rtnrbu");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			if_block0.m(div, null);
			append_hydration(div, t);
			if (if_block1) if_block1.m(div, null);

			if (!mounted) {
				dispose = listen(window, "keydown", /*handleKeydown*/ ctx[9]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(div, t);
				}
			}

			if (/*showGifModal*/ ctx[1] && /*currentGif*/ ctx[2]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					if_block1.m(div, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			if_block0.d();
			if (if_block1) if_block1.d();
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let currentView = 'main';
	let showGifModal = false;
	let currentGif = null;

	const workouts = {
		push: {
			title: 'Push Day Workout',
			warmup: [
				{
					name: 'Arm Circles',
					duration: '30 seconds each direction'
				},
				{
					name: 'Shoulder Rolls',
					duration: '20 reps forward and backward'
				},
				{
					name: 'Push-up to Downward Dog',
					duration: '10 reps'
				}
			],
			exercises: [
				{
					name: 'Barbell Bench Press',
					sets: '4 sets of 6-8 reps',
					rest: '90 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bench-Press.gif'
				},
				{
					name: 'Overhead Press',
					sets: '3 sets of 8-10 reps',
					rest: '75 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/07/Barbell-Standing-Military-Press.gif'
				},
				{
					name: 'Incline Dumbbell Press',
					sets: '3 sets of 10-12 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Dumbbell-Press.gif'
				},
				{
					name: 'Dips',
					sets: '3 sets of 8-12 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Triceps-Dips.gif'
				},
				{
					name: 'Lateral Raises',
					sets: '3 sets of 12-15 reps',
					rest: '45 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Lateral-Raise.gif'
				},
				{
					name: 'Close-Grip Bench Press',
					sets: '3 sets of 10-12 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/10/Close-Grip-Dumbbell-Press.gif'
				},
				{
					name: 'Overhead Tricep Extension',
					sets: '3 sets of 12-15 reps',
					rest: '45 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Seated-EZ-Bar-Overhead-Triceps-Extension.gif'
				}
			]
		},
		pull: {
			title: 'Pull Day Workout',
			warmup: [
				{
					name: 'Band Pull-Aparts',
					duration: '20 reps'
				},
				{
					name: 'Arm Swings',
					duration: '15 reps each arm'
				},
				{
					name: 'Cat-Cow Stretches',
					duration: '10 reps'
				}
			],
			exercises: [
				{
					name: 'Deadlifts',
					sets: '4 sets of 5-6 reps',
					rest: '2 minutes rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Deadlift.gif'
				},
				{
					name: 'Pull-ups/Lat Pulldowns',
					sets: '4 sets of 6-10 reps',
					rest: '90 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pull-up.gif'
				},
				{
					name: 'Barbell Rows',
					sets: '3 sets of 8-10 reps',
					rest: '75 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bent-Over-Row.gif'
				},
				{
					name: 'T-Bar Rows',
					sets: '3 sets of 10-12 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/04/t-bar-rows.gif'
				},
				{
					name: 'Face Pulls',
					sets: '3 sets of 15-20 reps',
					rest: '45 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif'
				},
				{
					name: 'Barbell Curls',
					sets: '3 sets of 10-12 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Curl.gif'
				},
				{
					name: 'Hammer Curls',
					sets: '3 sets of 12-15 reps',
					rest: '45 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hammer-Curl.gif'
				}
			]
		},
		legs: {
			title: 'Legs Day Workout',
			warmup: [
				{
					name: 'Leg Swings',
					duration: '15 reps each leg (front/back & side)'
				},
				{
					name: 'Bodyweight Squats',
					duration: '15 reps'
				},
				{
					name: 'Walking Lunges',
					duration: '10 reps each leg'
				}
			],
			exercises: [
				{
					name: 'Barbell Back Squats',
					sets: '4 sets of 6-8 reps',
					rest: '2 minutes rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Hack-Squat.gif'
				},
				{
					name: 'Romanian Deadlifts',
					sets: '3 sets of 8-10 reps',
					rest: '90 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Romanian-Deadlift.gif'
				},
				{
					name: 'Bulgarian Split Squats',
					sets: '3 sets of 10-12 reps each leg',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dumbbell-Bulgarian-Split-Squat.gif'
				},
				{
					name: 'Leg Press',
					sets: '3 sets of 12-15 reps',
					rest: '75 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif'
				},
				{
					name: 'Walking Lunges',
					sets: '3 sets of 12 reps each leg',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2023/09/dumbbell-lunges.gif'
				},
				{
					name: 'Calf Raises',
					sets: '4 sets of 15-20 reps',
					rest: '45 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Calf-Raises.gif'
				},
				{
					name: 'Leg Curls',
					sets: '3 sets of 12-15 reps',
					rest: '60 seconds rest',
					gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Leg-Curl.gif'
				}
			]
		}
	};

	function showWorkout(type) {
		$$invalidate(0, currentView = type);
	}

	function goBack() {
		$$invalidate(0, currentView = 'main');
	}

	function viewGif(exercise) {
		$$invalidate(2, currentGif = exercise);
		$$invalidate(1, showGifModal = true);
	}

	function closeGifModal() {
		$$invalidate(1, showGifModal = false);
		$$invalidate(2, currentGif = null);
	}

	// Close modal when clicking outside
	function handleModalClick(event) {
		if (event.target.classList.contains('modal-overlay')) {
			closeGifModal();
		}
	}

	// Close modal with Escape key
	function handleKeydown(event) {
		if (event.key === 'Escape' && showGifModal) {
			closeGifModal();
		}
	}

	const click_handler = () => showWorkout('push');
	const click_handler_1 = () => showWorkout('pull');
	const click_handler_2 = () => showWorkout('legs');
	const click_handler_3 = exercise => viewGif(exercise);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(10, props = $$props.props);
	};

	return [
		currentView,
		showGifModal,
		currentGif,
		workouts,
		showWorkout,
		goBack,
		viewGif,
		closeGifModal,
		handleModalClick,
		handleKeydown,
		props,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 10 });
	}
}

export { Component as default };
