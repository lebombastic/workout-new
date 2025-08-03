// yt audio best design so far - Updated August 3, 2025
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
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
}
function set_style(node, key, value, important) {
    if (value == null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
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
	child_ctx[39] = list[i];
	child_ctx[41] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[42] = list[i];
	return child_ctx;
}

// (826:4) {#if showSearchArea}
function create_if_block_2(ctx) {
	let div2;
	let h20;
	let t0;
	let t1;
	let div0;
	let input0;
	let t2;
	let button0;
	let t3;
	let t4;
	let div1;
	let t5;
	let t6;
	let t7;
	let t8;
	let t9;
	let div4;
	let h21;
	let t10;
	let t11;
	let div3;
	let input1;
	let t12;
	let button1;
	let t13;
	let t14;
	let mounted;
	let dispose;
	let if_block = /*searchResults*/ ctx[2].length > 0 && create_if_block_3(ctx);

	return {
		c() {
			div2 = element("div");
			h20 = element("h2");
			t0 = text("YouTube API Configuration");
			t1 = space();
			div0 = element("div");
			input0 = element("input");
			t2 = space();
			button0 = element("button");
			t3 = text("Save");
			t4 = space();
			div1 = element("div");
			t5 = text("Quota Used: ");
			t6 = text(/*quotaUsed*/ ctx[11]);
			t7 = text(" / ");
			t8 = text(quotaLimit);
			t9 = space();
			div4 = element("div");
			h21 = element("h2");
			t10 = text("Search Videos");
			t11 = space();
			div3 = element("div");
			input1 = element("input");
			t12 = space();
			button1 = element("button");
			t13 = text("Search");
			t14 = space();
			if (if_block) if_block.c();
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			h20 = claim_element(div2_nodes, "H2", { class: true });
			var h20_nodes = children(h20);
			t0 = claim_text(h20_nodes, "YouTube API Configuration");
			h20_nodes.forEach(detach);
			t1 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);

			input0 = claim_element(div0_nodes, "INPUT", {
				type: true,
				placeholder: true,
				class: true
			});

			t2 = claim_space(div0_nodes);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t3 = claim_text(button0_nodes, "Save");
			button0_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			t5 = claim_text(div1_nodes, "Quota Used: ");
			t6 = claim_text(div1_nodes, /*quotaUsed*/ ctx[11]);
			t7 = claim_text(div1_nodes, " / ");
			t8 = claim_text(div1_nodes, quotaLimit);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t9 = claim_space(nodes);
			div4 = claim_element(nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			h21 = claim_element(div4_nodes, "H2", { class: true });
			var h21_nodes = children(h21);
			t10 = claim_text(h21_nodes, "Search Videos");
			h21_nodes.forEach(detach);
			t11 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);

			input1 = claim_element(div3_nodes, "INPUT", {
				type: true,
				placeholder: true,
				class: true
			});

			t12 = claim_space(div3_nodes);
			button1 = claim_element(div3_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t13 = claim_text(button1_nodes, "Search");
			button1_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			t14 = claim_space(div4_nodes);
			if (if_block) if_block.l(div4_nodes);
			div4_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h20, "class", "svelte-1n849i6");
			attr(input0, "type", "password");
			attr(input0, "placeholder", "Enter YouTube Data API Key");
			attr(input0, "class", "api-input svelte-1n849i6");
			attr(button0, "class", "save-btn svelte-1n849i6");
			attr(div0, "class", "input-group svelte-1n849i6");
			attr(div1, "class", "quota-info svelte-1n849i6");
			attr(div2, "class", "api-section svelte-1n849i6");
			attr(h21, "class", "svelte-1n849i6");
			attr(input1, "type", "text");
			attr(input1, "placeholder", "Search for videos...");
			attr(input1, "class", "search-input svelte-1n849i6");
			attr(button1, "class", "search-btn svelte-1n849i6");
			attr(div3, "class", "input-group svelte-1n849i6");
			attr(div4, "class", "search-section svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, h20);
			append_hydration(h20, t0);
			append_hydration(div2, t1);
			append_hydration(div2, div0);
			append_hydration(div0, input0);
			set_input_value(input0, /*apiKey*/ ctx[0]);
			append_hydration(div0, t2);
			append_hydration(div0, button0);
			append_hydration(button0, t3);
			append_hydration(div2, t4);
			append_hydration(div2, div1);
			append_hydration(div1, t5);
			append_hydration(div1, t6);
			append_hydration(div1, t7);
			append_hydration(div1, t8);
			insert_hydration(target, t9, anchor);
			insert_hydration(target, div4, anchor);
			append_hydration(div4, h21);
			append_hydration(h21, t10);
			append_hydration(div4, t11);
			append_hydration(div4, div3);
			append_hydration(div3, input1);
			set_input_value(input1, /*searchQuery*/ ctx[1]);
			append_hydration(div3, t12);
			append_hydration(div3, button1);
			append_hydration(button1, t13);
			append_hydration(div4, t14);
			if (if_block) if_block.m(div4, null);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[26]),
					listen(input0, "blur", /*saveApiKey*/ ctx[14]),
					listen(button0, "click", /*saveApiKey*/ ctx[14]),
					listen(input1, "input", /*input1_input_handler*/ ctx[27]),
					listen(input1, "keydown", /*keydown_handler*/ ctx[28]),
					listen(button1, "click", /*searchVideos*/ ctx[15])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*apiKey*/ 1 && input0.value !== /*apiKey*/ ctx[0]) {
				set_input_value(input0, /*apiKey*/ ctx[0]);
			}

			if (dirty[0] & /*quotaUsed*/ 2048) set_data(t6, /*quotaUsed*/ ctx[11]);

			if (dirty[0] & /*searchQuery*/ 2 && input1.value !== /*searchQuery*/ ctx[1]) {
				set_input_value(input1, /*searchQuery*/ ctx[1]);
			}

			if (/*searchResults*/ ctx[2].length > 0) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_3(ctx);
					if_block.c();
					if_block.m(div4, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div2);
			if (detaching) detach(t9);
			if (detaching) detach(div4);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (859:8) {#if searchResults.length > 0}
function create_if_block_3(ctx) {
	let div;
	let each_value_1 = /*searchResults*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "search-results svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*addToPlaylist, searchResults*/ 65540) {
				each_value_1 = /*searchResults*/ ctx[2];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
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

// (861:12) {#each searchResults as video}
function create_each_block_1(ctx) {
	let div2;
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let div0;
	let h4;
	let t1_value = /*video*/ ctx[42].title + "";
	let t1;
	let t2;
	let p;
	let t3_value = /*video*/ ctx[42].channel + "";
	let t3;
	let t4;
	let div1;
	let button;
	let t5;
	let t6;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[29](/*video*/ ctx[42]);
	}

	return {
		c() {
			div2 = element("div");
			img = element("img");
			t0 = space();
			div0 = element("div");
			h4 = element("h4");
			t1 = text(t1_value);
			t2 = space();
			p = element("p");
			t3 = text(t3_value);
			t4 = space();
			div1 = element("div");
			button = element("button");
			t5 = text("Add");
			t6 = space();
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			img = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
			t0 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h4 = claim_element(div0_nodes, "H4", { class: true });
			var h4_nodes = children(h4);
			t1 = claim_text(h4_nodes, t1_value);
			h4_nodes.forEach(detach);
			t2 = claim_space(div0_nodes);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, t3_value);
			p_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			button = claim_element(div1_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t5 = claim_text(button_nodes, "Add");
			button_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t6 = claim_space(div2_nodes);
			div2_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*video*/ ctx[42].thumbnail)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*video*/ ctx[42].title);
			attr(img, "class", "thumbnail svelte-1n849i6");
			attr(h4, "class", "svelte-1n849i6");
			attr(p, "class", "svelte-1n849i6");
			attr(div0, "class", "video-info svelte-1n849i6");
			attr(button, "class", "add-btn svelte-1n849i6");
			attr(div1, "class", "video-actions svelte-1n849i6");
			attr(div2, "class", "video-item svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, img);
			append_hydration(div2, t0);
			append_hydration(div2, div0);
			append_hydration(div0, h4);
			append_hydration(h4, t1);
			append_hydration(div0, t2);
			append_hydration(div0, p);
			append_hydration(p, t3);
			append_hydration(div2, t4);
			append_hydration(div2, div1);
			append_hydration(div1, button);
			append_hydration(button, t5);
			append_hydration(div2, t6);

			if (!mounted) {
				dispose = listen(button, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*searchResults*/ 4 && !src_url_equal(img.src, img_src_value = /*video*/ ctx[42].thumbnail)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*searchResults*/ 4 && img_alt_value !== (img_alt_value = /*video*/ ctx[42].title)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty[0] & /*searchResults*/ 4 && t1_value !== (t1_value = /*video*/ ctx[42].title + "")) set_data(t1, t1_value);
			if (dirty[0] & /*searchResults*/ 4 && t3_value !== (t3_value = /*video*/ ctx[42].channel + "")) set_data(t3, t3_value);
		},
		d(detaching) {
			if (detaching) detach(div2);
			mounted = false;
			dispose();
		}
	};
}

// (884:10) {:else}
function create_else_block_1(ctx) {
	let div;
	let svg;
	let path;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			svg = claim_svg_element(div_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z");
			attr(svg, "width", "80");
			attr(svg, "height", "80");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "fill", "rgba(255,255,255,0.3)");
			attr(div, "class", "placeholder-art svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, svg);
			append_hydration(svg, path);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (882:10) {#if currentTrack}
function create_if_block_1(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*currentTrack*/ ctx[4].thumbnail)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*currentTrack*/ ctx[4].title);
			attr(img, "class", "svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*currentTrack*/ 16 && !src_url_equal(img.src, img_src_value = /*currentTrack*/ ctx[4].thumbnail)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*currentTrack*/ 16 && img_alt_value !== (img_alt_value = /*currentTrack*/ ctx[4].title)) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (927:14) {:else}
function create_else_block(ctx) {
	let svg;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M8 5v14l11-7z");
			attr(svg, "width", "32");
			attr(svg, "height", "32");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "fill", "currentColor");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (923:14) {#if isPlaying}
function create_if_block(ctx) {
	let svg;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
			attr(svg, "width", "32");
			attr(svg, "height", "32");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "fill", "currentColor");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (971:8) {#each playlist as track, index}
function create_each_block(ctx) {
	let div2;
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let div0;
	let h4;
	let t1_value = /*track*/ ctx[39].title + "";
	let t1;
	let t2;
	let p;
	let t3_value = /*track*/ ctx[39].channel + "";
	let t3;
	let t4;
	let div1;
	let button0;
	let t5;
	let t6;
	let button1;
	let t7;
	let t8;
	let div2_class_value;
	let mounted;
	let dispose;

	function click_handler_3() {
		return /*click_handler_3*/ ctx[32](/*track*/ ctx[39], /*index*/ ctx[41]);
	}

	function click_handler_4() {
		return /*click_handler_4*/ ctx[33](/*index*/ ctx[41]);
	}

	return {
		c() {
			div2 = element("div");
			img = element("img");
			t0 = space();
			div0 = element("div");
			h4 = element("h4");
			t1 = text(t1_value);
			t2 = space();
			p = element("p");
			t3 = text(t3_value);
			t4 = space();
			div1 = element("div");
			button0 = element("button");
			t5 = text("Play");
			t6 = space();
			button1 = element("button");
			t7 = text("Remove");
			t8 = space();
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			img = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
			t0 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h4 = claim_element(div0_nodes, "H4", { class: true });
			var h4_nodes = children(h4);
			t1 = claim_text(h4_nodes, t1_value);
			h4_nodes.forEach(detach);
			t2 = claim_space(div0_nodes);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, t3_value);
			p_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			button0 = claim_element(div1_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t5 = claim_text(button0_nodes, "Play");
			button0_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			button1 = claim_element(div1_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t7 = claim_text(button1_nodes, "Remove");
			button1_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t8 = claim_space(div2_nodes);
			div2_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*track*/ ctx[39].thumbnail)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*track*/ ctx[39].title);
			attr(img, "class", "playlist-thumbnail svelte-1n849i6");
			attr(h4, "class", "svelte-1n849i6");
			attr(p, "class", "svelte-1n849i6");
			attr(div0, "class", "playlist-info svelte-1n849i6");
			attr(button0, "class", "play-playlist-btn svelte-1n849i6");
			attr(button1, "class", "remove-btn svelte-1n849i6");
			attr(div1, "class", "playlist-actions svelte-1n849i6");

			attr(div2, "class", div2_class_value = "playlist-item " + (/*currentTrackIndex*/ ctx[5] === /*index*/ ctx[41]
			? 'active'
			: '') + " svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, img);
			append_hydration(div2, t0);
			append_hydration(div2, div0);
			append_hydration(div0, h4);
			append_hydration(h4, t1);
			append_hydration(div0, t2);
			append_hydration(div0, p);
			append_hydration(p, t3);
			append_hydration(div2, t4);
			append_hydration(div2, div1);
			append_hydration(div1, button0);
			append_hydration(button0, t5);
			append_hydration(div1, t6);
			append_hydration(div1, button1);
			append_hydration(button1, t7);
			append_hydration(div2, t8);

			if (!mounted) {
				dispose = [
					listen(button0, "click", click_handler_3),
					listen(button1, "click", click_handler_4)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*playlist*/ 8 && !src_url_equal(img.src, img_src_value = /*track*/ ctx[39].thumbnail)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*playlist*/ 8 && img_alt_value !== (img_alt_value = /*track*/ ctx[39].title)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty[0] & /*playlist*/ 8 && t1_value !== (t1_value = /*track*/ ctx[39].title + "")) set_data(t1, t1_value);
			if (dirty[0] & /*playlist*/ 8 && t3_value !== (t3_value = /*track*/ ctx[39].channel + "")) set_data(t3, t3_value);

			if (dirty[0] & /*currentTrackIndex*/ 32 && div2_class_value !== (div2_class_value = "playlist-item " + (/*currentTrackIndex*/ ctx[5] === /*index*/ ctx[41]
			? 'active'
			: '') + " svelte-1n849i6")) {
				attr(div2, "class", div2_class_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div2);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment(ctx) {
	let main;
	let div0;
	let t0;
	let div14;
	let div1;
	let button0;
	let t1_value = (/*showSearchArea*/ ctx[12] ? '🔼 Hide' : '🔽 Show') + "";
	let t1;
	let t2;
	let t3;
	let t4;
	let div10;
	let div9;
	let div2;
	let t5;
	let div8;
	let h3;
	let t6_value = (/*currentTrack*/ ctx[4]?.title || 'No track selected') + "";
	let t6;
	let t7;
	let p;
	let t8_value = (/*currentTrack*/ ctx[4]?.channel || 'Select a track to play') + "";
	let t8;
	let t9;
	let div5;
	let span0;
	let t10_value = formatTime(/*currentTime*/ ctx[7]) + "";
	let t10;
	let t11;
	let div4;
	let div3;
	let div4_aria_valuemax_value;
	let t12;
	let span1;
	let t13_value = formatTime(/*duration*/ ctx[8]) + "";
	let t13;
	let t14;
	let div6;
	let button1;
	let svg0;
	let path0;
	let t15;
	let button2;
	let button2_aria_label_value;
	let t16;
	let button3;
	let svg1;
	let path1;
	let t17;
	let div7;
	let button4;
	let t18;
	let button4_class_value;
	let t19;
	let button5;
	let t20;
	let button5_class_value;
	let t21;
	let div13;
	let div11;
	let h2;
	let t22;
	let t23_value = /*playlist*/ ctx[3].length + "";
	let t23;
	let t24;
	let t25;
	let button6;
	let t26;
	let t27;
	let div12;
	let mounted;
	let dispose;
	let if_block0 = /*showSearchArea*/ ctx[12] && create_if_block_2(ctx);

	function select_block_type(ctx, dirty) {
		if (/*currentTrack*/ ctx[4]) return create_if_block_1;
		return create_else_block_1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block1 = current_block_type(ctx);

	function select_block_type_1(ctx, dirty) {
		if (/*isPlaying*/ ctx[6]) return create_if_block;
		return create_else_block;
	}

	let current_block_type_1 = select_block_type_1(ctx);
	let if_block2 = current_block_type_1(ctx);
	let each_value = /*playlist*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			main = element("main");
			div0 = element("div");
			t0 = space();
			div14 = element("div");
			div1 = element("div");
			button0 = element("button");
			t1 = text(t1_value);
			t2 = text(" Search & API");
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			div10 = element("div");
			div9 = element("div");
			div2 = element("div");
			if_block1.c();
			t5 = space();
			div8 = element("div");
			h3 = element("h3");
			t6 = text(t6_value);
			t7 = space();
			p = element("p");
			t8 = text(t8_value);
			t9 = space();
			div5 = element("div");
			span0 = element("span");
			t10 = text(t10_value);
			t11 = space();
			div4 = element("div");
			div3 = element("div");
			t12 = space();
			span1 = element("span");
			t13 = text(t13_value);
			t14 = space();
			div6 = element("div");
			button1 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t15 = space();
			button2 = element("button");
			if_block2.c();
			t16 = space();
			button3 = element("button");
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			t17 = space();
			div7 = element("div");
			button4 = element("button");
			t18 = text("🔀");
			t19 = space();
			button5 = element("button");
			t20 = text("🔁");
			t21 = space();
			div13 = element("div");
			div11 = element("div");
			h2 = element("h2");
			t22 = text("Playlist (");
			t23 = text(t23_value);
			t24 = text(")");
			t25 = space();
			button6 = element("button");
			t26 = text("Export");
			t27 = space();
			div12 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			main = claim_element(nodes, "MAIN", {});
			var main_nodes = children(main);
			div0 = claim_element(main_nodes, "DIV", { id: true, style: true });
			children(div0).forEach(detach);
			t0 = claim_space(main_nodes);
			div14 = claim_element(main_nodes, "DIV", { class: true });
			var div14_nodes = children(div14);
			div1 = claim_element(div14_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			button0 = claim_element(div1_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t1 = claim_text(button0_nodes, t1_value);
			t2 = claim_text(button0_nodes, " Search & API");
			button0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t3 = claim_space(div14_nodes);
			if (if_block0) if_block0.l(div14_nodes);
			t4 = claim_space(div14_nodes);
			div10 = claim_element(div14_nodes, "DIV", { class: true });
			var div10_nodes = children(div10);
			div9 = claim_element(div10_nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			div2 = claim_element(div9_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			if_block1.l(div2_nodes);
			div2_nodes.forEach(detach);
			t5 = claim_space(div9_nodes);
			div8 = claim_element(div9_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);
			h3 = claim_element(div8_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t6 = claim_text(h3_nodes, t6_value);
			h3_nodes.forEach(detach);
			t7 = claim_space(div8_nodes);
			p = claim_element(div8_nodes, "P", { class: true });
			var p_nodes = children(p);
			t8 = claim_text(p_nodes, t8_value);
			p_nodes.forEach(detach);
			t9 = claim_space(div8_nodes);
			div5 = claim_element(div8_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			span0 = claim_element(div5_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t10 = claim_text(span0_nodes, t10_value);
			span0_nodes.forEach(detach);
			t11 = claim_space(div5_nodes);

			div4 = claim_element(div5_nodes, "DIV", {
				class: true,
				role: true,
				tabindex: true,
				"aria-label": true,
				"aria-valuemin": true,
				"aria-valuemax": true,
				"aria-valuenow": true
			});

			var div4_nodes = children(div4);
			div3 = claim_element(div4_nodes, "DIV", { class: true, style: true });
			children(div3).forEach(detach);
			div4_nodes.forEach(detach);
			t12 = claim_space(div5_nodes);
			span1 = claim_element(div5_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t13 = claim_text(span1_nodes, t13_value);
			span1_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			t14 = claim_space(div8_nodes);
			div6 = claim_element(div8_nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			button1 = claim_element(div6_nodes, "BUTTON", { class: true, "aria-label": true });
			var button1_nodes = children(button1);

			svg0 = claim_svg_element(button1_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			t15 = claim_space(div6_nodes);
			button2 = claim_element(div6_nodes, "BUTTON", { class: true, "aria-label": true });
			var button2_nodes = children(button2);
			if_block2.l(button2_nodes);
			button2_nodes.forEach(detach);
			t16 = claim_space(div6_nodes);
			button3 = claim_element(div6_nodes, "BUTTON", { class: true, "aria-label": true });
			var button3_nodes = children(button3);

			svg1 = claim_svg_element(button3_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			button3_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t17 = claim_space(div8_nodes);
			div7 = claim_element(div8_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);

			button4 = claim_element(div7_nodes, "BUTTON", {
				class: true,
				"aria-label": true,
				"aria-pressed": true
			});

			var button4_nodes = children(button4);
			t18 = claim_text(button4_nodes, "🔀");
			button4_nodes.forEach(detach);
			t19 = claim_space(div7_nodes);

			button5 = claim_element(div7_nodes, "BUTTON", {
				class: true,
				"aria-label": true,
				"aria-pressed": true
			});

			var button5_nodes = children(button5);
			t20 = claim_text(button5_nodes, "🔁");
			button5_nodes.forEach(detach);
			div7_nodes.forEach(detach);
			div8_nodes.forEach(detach);
			div9_nodes.forEach(detach);
			div10_nodes.forEach(detach);
			t21 = claim_space(div14_nodes);
			div13 = claim_element(div14_nodes, "DIV", { class: true });
			var div13_nodes = children(div13);
			div11 = claim_element(div13_nodes, "DIV", { class: true });
			var div11_nodes = children(div11);
			h2 = claim_element(div11_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t22 = claim_text(h2_nodes, "Playlist (");
			t23 = claim_text(h2_nodes, t23_value);
			t24 = claim_text(h2_nodes, ")");
			h2_nodes.forEach(detach);
			t25 = claim_space(div11_nodes);
			button6 = claim_element(div11_nodes, "BUTTON", { class: true });
			var button6_nodes = children(button6);
			t26 = claim_text(button6_nodes, "Export");
			button6_nodes.forEach(detach);
			div11_nodes.forEach(detach);
			t27 = claim_space(div13_nodes);
			div12 = claim_element(div13_nodes, "DIV", { class: true });
			var div12_nodes = children(div12);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div12_nodes);
			}

			div12_nodes.forEach(detach);
			div13_nodes.forEach(detach);
			div14_nodes.forEach(detach);
			main_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "id", "youtube-player");
			set_style(div0, "position", "absolute");
			set_style(div0, "top", "-9999px");
			set_style(div0, "left", "-9999px");
			set_style(div0, "width", "1px");
			set_style(div0, "height", "1px");
			attr(button0, "class", "toggle-btn svelte-1n849i6");
			attr(div1, "class", "toggle-section svelte-1n849i6");
			attr(div2, "class", "album-art svelte-1n849i6");
			attr(h3, "class", "svelte-1n849i6");
			attr(p, "class", "svelte-1n849i6");
			attr(span0, "class", "time svelte-1n849i6");
			attr(div3, "class", "progress-fill svelte-1n849i6");

			set_style(div3, "width", (/*duration*/ ctx[8]
			? /*currentTime*/ ctx[7] / /*duration*/ ctx[8] * 100
			: 0) + "%");

			attr(div4, "class", "progress-bar svelte-1n849i6");
			attr(div4, "role", "slider");
			attr(div4, "tabindex", "0");
			attr(div4, "aria-label", "Seek position");
			attr(div4, "aria-valuemin", "0");
			attr(div4, "aria-valuemax", div4_aria_valuemax_value = /*duration*/ ctx[8] || 0);
			attr(div4, "aria-valuenow", /*currentTime*/ ctx[7]);
			attr(span1, "class", "time svelte-1n849i6");
			attr(div5, "class", "progress-container svelte-1n849i6");
			attr(path0, "d", "M6 6h2v12H6zm3.5 6l8.5 6V6z");
			attr(svg0, "width", "24");
			attr(svg0, "height", "24");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "fill", "currentColor");
			attr(button1, "class", "control-btn svelte-1n849i6");
			attr(button1, "aria-label", "Previous track");
			attr(button2, "class", "play-btn svelte-1n849i6");
			attr(button2, "aria-label", button2_aria_label_value = /*isPlaying*/ ctx[6] ? 'Pause' : 'Play');
			attr(path1, "d", "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z");
			attr(svg1, "width", "24");
			attr(svg1, "height", "24");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "fill", "currentColor");
			attr(button3, "class", "control-btn svelte-1n849i6");
			attr(button3, "aria-label", "Next track");
			attr(div6, "class", "controls svelte-1n849i6");
			attr(button4, "class", button4_class_value = "extra-btn " + (/*isShuffled*/ ctx[9] ? 'active' : '') + " svelte-1n849i6");
			attr(button4, "aria-label", "Toggle shuffle");
			attr(button4, "aria-pressed", /*isShuffled*/ ctx[9]);
			attr(button5, "class", button5_class_value = "extra-btn " + (/*isRepeating*/ ctx[10] ? 'active' : '') + " svelte-1n849i6");
			attr(button5, "aria-label", "Toggle repeat");
			attr(button5, "aria-pressed", /*isRepeating*/ ctx[10]);
			attr(div7, "class", "extra-controls svelte-1n849i6");
			attr(div8, "class", "player-info svelte-1n849i6");
			attr(div9, "class", "player svelte-1n849i6");
			attr(div10, "class", "player-section svelte-1n849i6");
			attr(h2, "class", "svelte-1n849i6");
			attr(button6, "class", "export-btn svelte-1n849i6");
			attr(div11, "class", "playlist-header svelte-1n849i6");
			attr(div12, "class", "playlist svelte-1n849i6");
			attr(div13, "class", "playlist-section svelte-1n849i6");
			attr(div14, "class", "container svelte-1n849i6");
		},
		m(target, anchor) {
			insert_hydration(target, main, anchor);
			append_hydration(main, div0);
			append_hydration(main, t0);
			append_hydration(main, div14);
			append_hydration(div14, div1);
			append_hydration(div1, button0);
			append_hydration(button0, t1);
			append_hydration(button0, t2);
			append_hydration(div14, t3);
			if (if_block0) if_block0.m(div14, null);
			append_hydration(div14, t4);
			append_hydration(div14, div10);
			append_hydration(div10, div9);
			append_hydration(div9, div2);
			if_block1.m(div2, null);
			append_hydration(div9, t5);
			append_hydration(div9, div8);
			append_hydration(div8, h3);
			append_hydration(h3, t6);
			append_hydration(div8, t7);
			append_hydration(div8, p);
			append_hydration(p, t8);
			append_hydration(div8, t9);
			append_hydration(div8, div5);
			append_hydration(div5, span0);
			append_hydration(span0, t10);
			append_hydration(div5, t11);
			append_hydration(div5, div4);
			append_hydration(div4, div3);
			append_hydration(div5, t12);
			append_hydration(div5, span1);
			append_hydration(span1, t13);
			append_hydration(div8, t14);
			append_hydration(div8, div6);
			append_hydration(div6, button1);
			append_hydration(button1, svg0);
			append_hydration(svg0, path0);
			append_hydration(div6, t15);
			append_hydration(div6, button2);
			if_block2.m(button2, null);
			append_hydration(div6, t16);
			append_hydration(div6, button3);
			append_hydration(button3, svg1);
			append_hydration(svg1, path1);
			append_hydration(div8, t17);
			append_hydration(div8, div7);
			append_hydration(div7, button4);
			append_hydration(button4, t18);
			append_hydration(div7, t19);
			append_hydration(div7, button5);
			append_hydration(button5, t20);
			append_hydration(div14, t21);
			append_hydration(div14, div13);
			append_hydration(div13, div11);
			append_hydration(div11, h2);
			append_hydration(h2, t22);
			append_hydration(h2, t23);
			append_hydration(h2, t24);
			append_hydration(div11, t25);
			append_hydration(div11, button6);
			append_hydration(button6, t26);
			append_hydration(div13, t27);
			append_hydration(div13, div12);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div12, null);
				}
			}

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*toggleSearchArea*/ ctx[13]),
					listen(div4, "click", /*seek*/ ctx[22]),
					listen(div4, "keydown", /*handleSeekKeydown*/ ctx[23]),
					listen(button1, "click", /*previousTrack*/ ctx[20]),
					listen(button2, "click", /*togglePlayPause*/ ctx[19]),
					listen(button3, "click", /*nextTrack*/ ctx[21]),
					listen(button4, "click", /*click_handler_1*/ ctx[30]),
					listen(button5, "click", /*click_handler_2*/ ctx[31]),
					listen(button6, "click", /*exportPlaylist*/ ctx[24])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*showSearchArea*/ 4096 && t1_value !== (t1_value = (/*showSearchArea*/ ctx[12] ? '🔼 Hide' : '🔽 Show') + "")) set_data(t1, t1_value);

			if (/*showSearchArea*/ ctx[12]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_2(ctx);
					if_block0.c();
					if_block0.m(div14, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
				if_block1.p(ctx, dirty);
			} else {
				if_block1.d(1);
				if_block1 = current_block_type(ctx);

				if (if_block1) {
					if_block1.c();
					if_block1.m(div2, null);
				}
			}

			if (dirty[0] & /*currentTrack*/ 16 && t6_value !== (t6_value = (/*currentTrack*/ ctx[4]?.title || 'No track selected') + "")) set_data(t6, t6_value);
			if (dirty[0] & /*currentTrack*/ 16 && t8_value !== (t8_value = (/*currentTrack*/ ctx[4]?.channel || 'Select a track to play') + "")) set_data(t8, t8_value);
			if (dirty[0] & /*currentTime*/ 128 && t10_value !== (t10_value = formatTime(/*currentTime*/ ctx[7]) + "")) set_data(t10, t10_value);

			if (dirty[0] & /*duration, currentTime*/ 384) {
				set_style(div3, "width", (/*duration*/ ctx[8]
				? /*currentTime*/ ctx[7] / /*duration*/ ctx[8] * 100
				: 0) + "%");
			}

			if (dirty[0] & /*duration*/ 256 && div4_aria_valuemax_value !== (div4_aria_valuemax_value = /*duration*/ ctx[8] || 0)) {
				attr(div4, "aria-valuemax", div4_aria_valuemax_value);
			}

			if (dirty[0] & /*currentTime*/ 128) {
				attr(div4, "aria-valuenow", /*currentTime*/ ctx[7]);
			}

			if (dirty[0] & /*duration*/ 256 && t13_value !== (t13_value = formatTime(/*duration*/ ctx[8]) + "")) set_data(t13, t13_value);

			if (current_block_type_1 !== (current_block_type_1 = select_block_type_1(ctx))) {
				if_block2.d(1);
				if_block2 = current_block_type_1(ctx);

				if (if_block2) {
					if_block2.c();
					if_block2.m(button2, null);
				}
			}

			if (dirty[0] & /*isPlaying*/ 64 && button2_aria_label_value !== (button2_aria_label_value = /*isPlaying*/ ctx[6] ? 'Pause' : 'Play')) {
				attr(button2, "aria-label", button2_aria_label_value);
			}

			if (dirty[0] & /*isShuffled*/ 512 && button4_class_value !== (button4_class_value = "extra-btn " + (/*isShuffled*/ ctx[9] ? 'active' : '') + " svelte-1n849i6")) {
				attr(button4, "class", button4_class_value);
			}

			if (dirty[0] & /*isShuffled*/ 512) {
				attr(button4, "aria-pressed", /*isShuffled*/ ctx[9]);
			}

			if (dirty[0] & /*isRepeating*/ 1024 && button5_class_value !== (button5_class_value = "extra-btn " + (/*isRepeating*/ ctx[10] ? 'active' : '') + " svelte-1n849i6")) {
				attr(button5, "class", button5_class_value);
			}

			if (dirty[0] & /*isRepeating*/ 1024) {
				attr(button5, "aria-pressed", /*isRepeating*/ ctx[10]);
			}

			if (dirty[0] & /*playlist*/ 8 && t23_value !== (t23_value = /*playlist*/ ctx[3].length + "")) set_data(t23, t23_value);

			if (dirty[0] & /*currentTrackIndex, removeFromPlaylist, playTrack, playlist*/ 393256) {
				each_value = /*playlist*/ ctx[3];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div12, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(main);
			if (if_block0) if_block0.d();
			if_block1.d();
			if_block2.d();
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}
let quotaLimit = 10000;

// Format time
function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;

	// State variables
	let apiKey = '';

	let searchQuery = '';
	let searchResults = [];
	let playlist = [];
	let currentTrack = null;
	let currentTrackIndex = -1;
	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let isShuffled = false;
	let isRepeating = false;
	let quotaUsed = 0;
	let showSearchArea = true;

	// YouTube player variables
	let youtubePlayer = null;

	let playerReady = false;

	// Load data from localStorage on mount
	onMount(() => {
		const savedApiKey = localStorage.getItem('youtube-api-key');
		const savedPlaylist = localStorage.getItem('youtube-playlist');
		const savedQuota = localStorage.getItem('youtube-quota');
		const savedShowSearch = localStorage.getItem('show-search-area');
		if (savedApiKey) $$invalidate(0, apiKey = savedApiKey);
		if (savedPlaylist) $$invalidate(3, playlist = JSON.parse(savedPlaylist));
		if (savedQuota) $$invalidate(11, quotaUsed = parseInt(savedQuota));
		if (savedShowSearch !== null) $$invalidate(12, showSearchArea = JSON.parse(savedShowSearch));

		// Load YouTube iframe API
		if (!window.YT) {
			window.onYouTubeIframeAPIReady = initializePlayer;
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild(tag);
		} else if (window.YT && window.YT.Player) {
			initializePlayer();
		}
	});

	// Initialize YouTube player
	function initializePlayer() {
		if (document.getElementById('youtube-player')) {
			youtubePlayer = new YT.Player('youtube-player',
			{
					height: '1',
					width: '1',
					playerVars: {
						autoplay: 0,
						controls: 0,
						disablekb: 1,
						fs: 0,
						modestbranding: 1,
						rel: 0,
						iv_load_policy: 3
					},
					events: {
						onReady: () => {
							playerReady = true;
						},
						onStateChange: onPlayerStateChange,
						onError: event => {
							console.error('YouTube player error:', event.data);
						}
					}
				});
		}
	}

	// Handle player state changes
	function onPlayerStateChange(event) {
		if (event.data === YT.PlayerState.PLAYING) {
			$$invalidate(6, isPlaying = true);
			updateProgress();
		} else if (event.data === YT.PlayerState.PAUSED) {
			$$invalidate(6, isPlaying = false);
		} else if (event.data === YT.PlayerState.ENDED) {
			nextTrack();
		}
	}

	// Update progress
	function updateProgress() {
		if (youtubePlayer && isPlaying && playerReady) {
			$$invalidate(7, currentTime = youtubePlayer.getCurrentTime());
			$$invalidate(8, duration = youtubePlayer.getDuration());

			if (isPlaying) {
				setTimeout(updateProgress, 1000);
			}
		}
	}

	// Toggle search area visibility
	function toggleSearchArea() {
		$$invalidate(12, showSearchArea = !showSearchArea);
		localStorage.setItem('show-search-area', JSON.stringify(showSearchArea));
	}

	// Save API key
	function saveApiKey() {
		localStorage.setItem('youtube-api-key', apiKey);
	}

	// Search YouTube videos
	async function searchVideos() {
		if (!apiKey || !searchQuery) return;
		if (quotaUsed >= quotaLimit) return;

		try {
			const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(searchQuery)}&type=video&key=${apiKey}`);
			if (!response.ok) throw new Error('Search failed');
			const data = await response.json();

			$$invalidate(2, searchResults = data.items.map(item => ({
				id: item.id.videoId,
				title: item.snippet.title,
				channel: item.snippet.channelTitle,
				thumbnail: item.snippet.thumbnails.medium.url,
				url: `https://www.youtube.com/watch?v=${item.id.videoId}`
			})));

			$$invalidate(11, quotaUsed += 100);
			localStorage.setItem('youtube-quota', quotaUsed.toString());
		} catch(error) {
			console.error('Search failed:', error);
		}
	}

	// Add to playlist
	function addToPlaylist(video) {
		if (!playlist.find(item => item.id === video.id)) {
			$$invalidate(3, playlist = [...playlist, video]);
			localStorage.setItem('youtube-playlist', JSON.stringify(playlist));
		}
	}

	// Remove from playlist
	function removeFromPlaylist(index) {
		$$invalidate(3, playlist = playlist.filter((_, i) => i !== index));
		localStorage.setItem('youtube-playlist', JSON.stringify(playlist));

		if (currentTrackIndex === index) {
			$$invalidate(4, currentTrack = null);
			$$invalidate(5, currentTrackIndex = -1);
			$$invalidate(6, isPlaying = false);
		} else if (currentTrackIndex > index) {
			$$invalidate(5, currentTrackIndex--, currentTrackIndex);
		}
	}

	// Play track
	function playTrack(track, index) {
		if (!window.YT || !window.YT.Player) return;

		if (!playerReady || !youtubePlayer) {
			setTimeout(() => playTrack(track, index), 1000);
			return;
		}

		$$invalidate(4, currentTrack = track);
		$$invalidate(5, currentTrackIndex = index);

		try {
			youtubePlayer.loadVideoById(track.id);
		} catch(error) {
			console.error('Error loading video:', error);
		}
	}

	// Toggle play/pause
	function togglePlayPause() {
		if (!currentTrack) {
			if (playlist.length > 0) {
				playTrack(playlist[0], 0);
			}

			return;
		}

		if (!playerReady || !youtubePlayer) return;

		if (isPlaying) {
			youtubePlayer.pauseVideo();
		} else {
			youtubePlayer.playVideo();
		}
	}

	// Previous track
	function previousTrack() {
		if (playlist.length === 0) return;
		let newIndex = currentTrackIndex - 1;
		if (newIndex < 0) newIndex = playlist.length - 1;
		playTrack(playlist[newIndex], newIndex);
	}

	// Next track
	function nextTrack() {
		if (playlist.length === 0) return;
		let newIndex;

		if (isShuffled) {
			newIndex = Math.floor(Math.random() * playlist.length);
		} else {
			newIndex = currentTrackIndex + 1;

			if (newIndex >= playlist.length) {
				newIndex = isRepeating ? 0 : playlist.length - 1;
			}
		}

		playTrack(playlist[newIndex], newIndex);
	}

	// Seek
	function seek(event) {
		if (!youtubePlayer || !playerReady || !duration) return;
		const rect = event.target.getBoundingClientRect();
		const percent = (event.clientX - rect.left) / rect.width;
		const seekTime = percent * duration;
		youtubePlayer.seekTo(seekTime, true);
	}

	// Handle keyboard events for seek
	function handleSeekKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			seek(event);
		}
	}

	// Export playlist
	function exportPlaylist() {
		const urls = playlist.map(track => track.url).join('\n');
		const blob = new Blob([urls], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'youtube-playlist.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	function input0_input_handler() {
		apiKey = this.value;
		$$invalidate(0, apiKey);
	}

	function input1_input_handler() {
		searchQuery = this.value;
		$$invalidate(1, searchQuery);
	}

	const keydown_handler = e => e.key === 'Enter' && searchVideos();
	const click_handler = video => addToPlaylist(video);
	const click_handler_1 = () => $$invalidate(9, isShuffled = !isShuffled);
	const click_handler_2 = () => $$invalidate(10, isRepeating = !isRepeating);
	const click_handler_3 = (track, index) => playTrack(track, index);
	const click_handler_4 = index => removeFromPlaylist(index);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(25, props = $$props.props);
	};

	return [
		apiKey,
		searchQuery,
		searchResults,
		playlist,
		currentTrack,
		currentTrackIndex,
		isPlaying,
		currentTime,
		duration,
		isShuffled,
		isRepeating,
		quotaUsed,
		showSearchArea,
		toggleSearchArea,
		saveApiKey,
		searchVideos,
		addToPlaylist,
		removeFromPlaylist,
		playTrack,
		togglePlayPause,
		previousTrack,
		nextTrack,
		seek,
		handleSeekKeydown,
		exportPlaylist,
		props,
		input0_input_handler,
		input1_input_handler,
		keydown_handler,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 25 }, null, [-1, -1]);
	}
}

export { Component as default };
