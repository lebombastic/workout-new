// New Block - Updated September 4, 2025
function noop() { }
const identity = x => x;
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

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
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
function append(target, node) {
    target.appendChild(node);
}
function get_root_for_style(node) {
    if (!node)
        return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && root.host) {
        return root;
    }
    return node.ownerDocument;
}
function append_empty_stylesheet(node) {
    const style_element = element('style');
    append_stylesheet(get_root_for_style(node), style_element);
    return style_element.sheet;
}
function append_stylesheet(node, style) {
    append(node.head || node, style);
    return style.sheet;
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
function stop_propagation(fn) {
    return function (event) {
        event.stopPropagation();
        // @ts-ignore
        return fn.call(this, event);
    };
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function to_number(value) {
    return value === '' ? null : +value;
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
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
    return e;
}

// we need to store the information for multiple documents because a Svelte application could also contain iframes
// https://github.com/sveltejs/svelte/issues/3624
const managed_styles = new Map();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_style_information(doc, node) {
    const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
    managed_styles.set(doc, info);
    return info;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = get_root_for_style(node);
    const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
    if (!rules[name]) {
        rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        managed_styles.forEach(info => {
            const { ownerNode } = info.stylesheet;
            // there is no ownerNode if it runs on jsdom.
            if (ownerNode)
                detach(ownerNode);
        });
        managed_styles.clear();
    });
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

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
    else if (callback) {
        callback();
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    const options = { direction: 'in' };
    let config = fn(node, params, options);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            started = true;
            delete_rule(node);
            if (is_function(config)) {
                config = config(options);
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_bidirectional_transition(node, fn, params, intro) {
    const options = { direction: 'both' };
    let config = fn(node, params, options);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = (program.b - t);
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program || pending_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config(options);
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
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

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}

function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        easing,
        css: t => `opacity: ${t * o}`
    };
}
function slide(node, { delay = 0, duration = 400, easing = cubicOut, axis = 'y' } = {}) {
    const style = getComputedStyle(node);
    const opacity = +style.opacity;
    const primary_property = axis === 'y' ? 'height' : 'width';
    const primary_property_value = parseFloat(style[primary_property]);
    const secondary_properties = axis === 'y' ? ['top', 'bottom'] : ['left', 'right'];
    const capitalized_secondary_properties = secondary_properties.map((e) => `${e[0].toUpperCase()}${e.slice(1)}`);
    const padding_start_value = parseFloat(style[`padding${capitalized_secondary_properties[0]}`]);
    const padding_end_value = parseFloat(style[`padding${capitalized_secondary_properties[1]}`]);
    const margin_start_value = parseFloat(style[`margin${capitalized_secondary_properties[0]}`]);
    const margin_end_value = parseFloat(style[`margin${capitalized_secondary_properties[1]}`]);
    const border_width_start_value = parseFloat(style[`border${capitalized_secondary_properties[0]}Width`]);
    const border_width_end_value = parseFloat(style[`border${capitalized_secondary_properties[1]}Width`]);
    return {
        delay,
        duration,
        easing,
        css: t => 'overflow: hidden;' +
            `opacity: ${Math.min(t * 20, 1) * opacity};` +
            `${primary_property}: ${t * primary_property_value}px;` +
            `padding-${secondary_properties[0]}: ${t * padding_start_value}px;` +
            `padding-${secondary_properties[1]}: ${t * padding_end_value}px;` +
            `margin-${secondary_properties[0]}: ${t * margin_start_value}px;` +
            `margin-${secondary_properties[1]}: ${t * margin_end_value}px;` +
            `border-${secondary_properties[0]}-width: ${t * border_width_start_value}px;` +
            `border-${secondary_properties[1]}-width: ${t * border_width_end_value}px;`
    };
}

/* generated by Svelte v3.59.1 */

function create_else_block(ctx) {
	let div1;
	let h2;
	let t0;
	let t1;
	let div0;
	let label;
	let t2;
	let t3;
	let input;
	let t4;
	let button;
	let t5;
	let button_disabled_value;
	let t6;
	let div1_intro;
	let mounted;
	let dispose;
	let if_block = /*showResult*/ ctx[5] && /*analysisResult*/ ctx[4] && create_if_block_5(ctx);

	return {
		c() {
			div1 = element("div");
			h2 = element("h2");
			t0 = text("Blood Sugar Analysis");
			t1 = space();
			div0 = element("div");
			label = element("label");
			t2 = text("Enter Blood Sugar Reading (mg/dL)");
			t3 = space();
			input = element("input");
			t4 = space();
			button = element("button");
			t5 = text("Analyze Reading");
			t6 = space();
			if (if_block) if_block.c();
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h2 = claim_element(div1_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, "Blood Sugar Analysis");
			h2_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			label = claim_element(div0_nodes, "LABEL", { for: true, class: true });
			var label_nodes = children(label);
			t2 = claim_text(label_nodes, "Enter Blood Sugar Reading (mg/dL)");
			label_nodes.forEach(detach);
			t3 = claim_space(div0_nodes);

			input = claim_element(div0_nodes, "INPUT", {
				id: true,
				type: true,
				placeholder: true,
				min: true,
				max: true,
				class: true
			});

			t4 = claim_space(div0_nodes);
			button = claim_element(div0_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t5 = claim_text(button_nodes, "Analyze Reading");
			button_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			if (if_block) if_block.l(div1_nodes);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "class", "svelte-1qss0dm");
			attr(label, "for", "bloodSugar");
			attr(label, "class", "svelte-1qss0dm");
			attr(input, "id", "bloodSugar");
			attr(input, "type", "number");
			attr(input, "placeholder", "Enter reading...");
			attr(input, "min", "0");
			attr(input, "max", "500");
			attr(input, "class", "svelte-1qss0dm");
			attr(button, "class", "analyze-btn svelte-1qss0dm");
			button.disabled = button_disabled_value = !/*bloodSugar*/ ctx[3];
			attr(div0, "class", "input-section svelte-1qss0dm");
			attr(div1, "class", "blood-view");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, h2);
			append_hydration(h2, t0);
			append_hydration(div1, t1);
			append_hydration(div1, div0);
			append_hydration(div0, label);
			append_hydration(label, t2);
			append_hydration(div0, t3);
			append_hydration(div0, input);
			set_input_value(input, /*bloodSugar*/ ctx[3]);
			append_hydration(div0, t4);
			append_hydration(div0, button);
			append_hydration(button, t5);
			append_hydration(div1, t6);
			if (if_block) if_block.m(div1, null);

			if (!mounted) {
				dispose = [
					listen(input, "input", /*input_input_handler*/ ctx[21]),
					listen(button, "click", /*analyzeReading*/ ctx[10])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*bloodSugar*/ 8 && to_number(input.value) !== /*bloodSugar*/ ctx[3]) {
				set_input_value(input, /*bloodSugar*/ ctx[3]);
			}

			if (dirty & /*bloodSugar*/ 8 && button_disabled_value !== (button_disabled_value = !/*bloodSugar*/ ctx[3])) {
				button.disabled = button_disabled_value;
			}

			if (/*showResult*/ ctx[5] && /*analysisResult*/ ctx[4]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*showResult, analysisResult*/ 48) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_5(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(div1, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i(local) {
			transition_in(if_block);

			if (!div1_intro) {
				add_render_callback(() => {
					div1_intro = create_in_transition(div1, fade, { duration: 300, easing: func_6 });
					div1_intro.start();
				});
			}
		},
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (417:3) {#if currentView === 'meal'}
function create_if_block(ctx) {
	let div6;
	let h2;
	let t0;
	let t1;
	let div0;
	let button0;
	let span0;
	let t2;
	let t3;
	let svg0;
	let path0;
	let t4;
	let t5;
	let div2;
	let button2;
	let span1;
	let t6;
	let t7;
	let div1;
	let button1;
	let svg1;
	let path1;
	let t8;
	let svg2;
	let path2;
	let t9;
	let t10;
	let div3;
	let button3;
	let span2;
	let t11;
	let t12;
	let svg3;
	let path3;
	let t13;
	let t14;
	let div5;
	let button5;
	let span3;
	let t15;
	let t16;
	let div4;
	let button4;
	let svg4;
	let path4;
	let t17;
	let svg5;
	let path5;
	let t18;
	let div6_intro;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*accordionStates*/ ctx[1].breakfast && create_if_block_4(ctx);
	let if_block1 = /*accordionStates*/ ctx[1].lunch && create_if_block_3(ctx);
	let if_block2 = /*accordionStates*/ ctx[1].snack && create_if_block_2(ctx);
	let if_block3 = /*accordionStates*/ ctx[1].dinner && create_if_block_1(ctx);

	return {
		c() {
			div6 = element("div");
			h2 = element("h2");
			t0 = text("Daily Meal Plan");
			t1 = space();
			div0 = element("div");
			button0 = element("button");
			span0 = element("span");
			t2 = text("Breakfast");
			t3 = space();
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t4 = space();
			if (if_block0) if_block0.c();
			t5 = space();
			div2 = element("div");
			button2 = element("button");
			span1 = element("span");
			t6 = text("Lunch");
			t7 = space();
			div1 = element("div");
			button1 = element("button");
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			t8 = space();
			svg2 = svg_element("svg");
			path2 = svg_element("path");
			t9 = space();
			if (if_block1) if_block1.c();
			t10 = space();
			div3 = element("div");
			button3 = element("button");
			span2 = element("span");
			t11 = text("Snack");
			t12 = space();
			svg3 = svg_element("svg");
			path3 = svg_element("path");
			t13 = space();
			if (if_block2) if_block2.c();
			t14 = space();
			div5 = element("div");
			button5 = element("button");
			span3 = element("span");
			t15 = text("Dinner");
			t16 = space();
			div4 = element("div");
			button4 = element("button");
			svg4 = svg_element("svg");
			path4 = svg_element("path");
			t17 = space();
			svg5 = svg_element("svg");
			path5 = svg_element("path");
			t18 = space();
			if (if_block3) if_block3.c();
			this.h();
		},
		l(nodes) {
			div6 = claim_element(nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			h2 = claim_element(div6_nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, "Daily Meal Plan");
			h2_nodes.forEach(detach);
			t1 = claim_space(div6_nodes);
			div0 = claim_element(div6_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			span0 = claim_element(button0_nodes, "SPAN", {});
			var span0_nodes = children(span0);
			t2 = claim_text(span0_nodes, "Breakfast");
			span0_nodes.forEach(detach);
			t3 = claim_space(button0_nodes);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				class: true,
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t4 = claim_space(div0_nodes);
			if (if_block0) if_block0.l(div0_nodes);
			div0_nodes.forEach(detach);
			t5 = claim_space(div6_nodes);
			div2 = claim_element(div6_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			button2 = claim_element(div2_nodes, "BUTTON", { class: true });
			var button2_nodes = children(button2);
			span1 = claim_element(button2_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t6 = claim_text(span1_nodes, "Lunch");
			span1_nodes.forEach(detach);
			t7 = claim_space(button2_nodes);
			div1 = claim_element(button2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			button1 = claim_element(div1_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);

			svg1 = claim_svg_element(button1_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);

			svg2 = claim_svg_element(div1_nodes, "svg", {
				class: true,
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg2_nodes = children(svg2);
			path2 = claim_svg_element(svg2_nodes, "path", { d: true });
			children(path2).forEach(detach);
			svg2_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			button2_nodes.forEach(detach);
			t9 = claim_space(div2_nodes);
			if (if_block1) if_block1.l(div2_nodes);
			div2_nodes.forEach(detach);
			t10 = claim_space(div6_nodes);
			div3 = claim_element(div6_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			button3 = claim_element(div3_nodes, "BUTTON", { class: true });
			var button3_nodes = children(button3);
			span2 = claim_element(button3_nodes, "SPAN", {});
			var span2_nodes = children(span2);
			t11 = claim_text(span2_nodes, "Snack");
			span2_nodes.forEach(detach);
			t12 = claim_space(button3_nodes);

			svg3 = claim_svg_element(button3_nodes, "svg", {
				class: true,
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg3_nodes = children(svg3);
			path3 = claim_svg_element(svg3_nodes, "path", { d: true });
			children(path3).forEach(detach);
			svg3_nodes.forEach(detach);
			button3_nodes.forEach(detach);
			t13 = claim_space(div3_nodes);
			if (if_block2) if_block2.l(div3_nodes);
			div3_nodes.forEach(detach);
			t14 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			button5 = claim_element(div5_nodes, "BUTTON", { class: true });
			var button5_nodes = children(button5);
			span3 = claim_element(button5_nodes, "SPAN", {});
			var span3_nodes = children(span3);
			t15 = claim_text(span3_nodes, "Dinner");
			span3_nodes.forEach(detach);
			t16 = claim_space(button5_nodes);
			div4 = claim_element(button5_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			button4 = claim_element(div4_nodes, "BUTTON", { class: true });
			var button4_nodes = children(button4);

			svg4 = claim_svg_element(button4_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg4_nodes = children(svg4);
			path4 = claim_svg_element(svg4_nodes, "path", { d: true });
			children(path4).forEach(detach);
			svg4_nodes.forEach(detach);
			button4_nodes.forEach(detach);
			t17 = claim_space(div4_nodes);

			svg5 = claim_svg_element(div4_nodes, "svg", {
				class: true,
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg5_nodes = children(svg5);
			path5 = claim_svg_element(svg5_nodes, "path", { d: true });
			children(path5).forEach(detach);
			svg5_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			button5_nodes.forEach(detach);
			t18 = claim_space(div5_nodes);
			if (if_block3) if_block3.l(div5_nodes);
			div5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "class", "svelte-1qss0dm");
			attr(path0, "d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
			attr(svg0, "class", "chevron svelte-1qss0dm");
			attr(svg0, "width", "20");
			attr(svg0, "height", "20");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "fill", "currentColor");
			toggle_class(svg0, "rotated", /*accordionStates*/ ctx[1].breakfast);
			attr(button0, "class", "accordion-header svelte-1qss0dm");
			attr(div0, "class", "accordion svelte-1qss0dm");
			attr(path1, "d", "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z");
			attr(svg1, "width", "16");
			attr(svg1, "height", "16");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "fill", "currentColor");
			attr(button1, "class", "shuffle-btn svelte-1qss0dm");
			attr(path2, "d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
			attr(svg2, "class", "chevron svelte-1qss0dm");
			attr(svg2, "width", "20");
			attr(svg2, "height", "20");
			attr(svg2, "viewBox", "0 0 24 24");
			attr(svg2, "fill", "currentColor");
			toggle_class(svg2, "rotated", /*accordionStates*/ ctx[1].lunch);
			attr(div1, "class", "header-actions svelte-1qss0dm");
			attr(button2, "class", "accordion-header svelte-1qss0dm");
			attr(div2, "class", "accordion svelte-1qss0dm");
			attr(path3, "d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
			attr(svg3, "class", "chevron svelte-1qss0dm");
			attr(svg3, "width", "20");
			attr(svg3, "height", "20");
			attr(svg3, "viewBox", "0 0 24 24");
			attr(svg3, "fill", "currentColor");
			toggle_class(svg3, "rotated", /*accordionStates*/ ctx[1].snack);
			attr(button3, "class", "accordion-header svelte-1qss0dm");
			attr(div3, "class", "accordion svelte-1qss0dm");
			attr(path4, "d", "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z");
			attr(svg4, "width", "16");
			attr(svg4, "height", "16");
			attr(svg4, "viewBox", "0 0 24 24");
			attr(svg4, "fill", "currentColor");
			attr(button4, "class", "shuffle-btn svelte-1qss0dm");
			attr(path5, "d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
			attr(svg5, "class", "chevron svelte-1qss0dm");
			attr(svg5, "width", "20");
			attr(svg5, "height", "20");
			attr(svg5, "viewBox", "0 0 24 24");
			attr(svg5, "fill", "currentColor");
			toggle_class(svg5, "rotated", /*accordionStates*/ ctx[1].dinner);
			attr(div4, "class", "header-actions svelte-1qss0dm");
			attr(button5, "class", "accordion-header svelte-1qss0dm");
			attr(div5, "class", "accordion svelte-1qss0dm");
			attr(div6, "class", "meal-view");
		},
		m(target, anchor) {
			insert_hydration(target, div6, anchor);
			append_hydration(div6, h2);
			append_hydration(h2, t0);
			append_hydration(div6, t1);
			append_hydration(div6, div0);
			append_hydration(div0, button0);
			append_hydration(button0, span0);
			append_hydration(span0, t2);
			append_hydration(button0, t3);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			append_hydration(div0, t4);
			if (if_block0) if_block0.m(div0, null);
			append_hydration(div6, t5);
			append_hydration(div6, div2);
			append_hydration(div2, button2);
			append_hydration(button2, span1);
			append_hydration(span1, t6);
			append_hydration(button2, t7);
			append_hydration(button2, div1);
			append_hydration(div1, button1);
			append_hydration(button1, svg1);
			append_hydration(svg1, path1);
			append_hydration(div1, t8);
			append_hydration(div1, svg2);
			append_hydration(svg2, path2);
			append_hydration(div2, t9);
			if (if_block1) if_block1.m(div2, null);
			append_hydration(div6, t10);
			append_hydration(div6, div3);
			append_hydration(div3, button3);
			append_hydration(button3, span2);
			append_hydration(span2, t11);
			append_hydration(button3, t12);
			append_hydration(button3, svg3);
			append_hydration(svg3, path3);
			append_hydration(div3, t13);
			if (if_block2) if_block2.m(div3, null);
			append_hydration(div6, t14);
			append_hydration(div6, div5);
			append_hydration(div5, button5);
			append_hydration(button5, span3);
			append_hydration(span3, t15);
			append_hydration(button5, t16);
			append_hydration(button5, div4);
			append_hydration(div4, button4);
			append_hydration(button4, svg4);
			append_hydration(svg4, path4);
			append_hydration(div4, t17);
			append_hydration(div4, svg5);
			append_hydration(svg5, path5);
			append_hydration(div5, t18);
			if (if_block3) if_block3.m(div5, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler_2*/ ctx[15]),
					listen(button1, "click", stop_propagation(/*click_handler_3*/ ctx[16])),
					listen(button2, "click", /*click_handler_4*/ ctx[17]),
					listen(button3, "click", /*click_handler_5*/ ctx[18]),
					listen(button4, "click", stop_propagation(/*click_handler_6*/ ctx[19])),
					listen(button5, "click", /*click_handler_7*/ ctx[20])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (!current || dirty & /*accordionStates*/ 2) {
				toggle_class(svg0, "rotated", /*accordionStates*/ ctx[1].breakfast);
			}

			if (/*accordionStates*/ ctx[1].breakfast) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*accordionStates*/ 2) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_4(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(div0, null);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (!current || dirty & /*accordionStates*/ 2) {
				toggle_class(svg2, "rotated", /*accordionStates*/ ctx[1].lunch);
			}

			if (/*accordionStates*/ ctx[1].lunch) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*accordionStates*/ 2) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_3(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div2, null);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			if (!current || dirty & /*accordionStates*/ 2) {
				toggle_class(svg3, "rotated", /*accordionStates*/ ctx[1].snack);
			}

			if (/*accordionStates*/ ctx[1].snack) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty & /*accordionStates*/ 2) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block_2(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(div3, null);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}

			if (!current || dirty & /*accordionStates*/ 2) {
				toggle_class(svg5, "rotated", /*accordionStates*/ ctx[1].dinner);
			}

			if (/*accordionStates*/ ctx[1].dinner) {
				if (if_block3) {
					if_block3.p(ctx, dirty);

					if (dirty & /*accordionStates*/ 2) {
						transition_in(if_block3, 1);
					}
				} else {
					if_block3 = create_if_block_1(ctx);
					if_block3.c();
					transition_in(if_block3, 1);
					if_block3.m(div5, null);
				}
			} else if (if_block3) {
				group_outros();

				transition_out(if_block3, 1, 1, () => {
					if_block3 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			transition_in(if_block1);
			transition_in(if_block2);
			transition_in(if_block3);

			if (!div6_intro) {
				add_render_callback(() => {
					div6_intro = create_in_transition(div6, fade, { duration: 300, easing: func_4 });
					div6_intro.start();
				});
			}

			current = true;
		},
		o(local) {
			transition_out(if_block0);
			transition_out(if_block1);
			transition_out(if_block2);
			transition_out(if_block3);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div6);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (516:7) {#if showResult && analysisResult}
function create_if_block_5(ctx) {
	let div1;
	let h3;
	let t0_value = /*analysisResult*/ ctx[4].level + "";
	let t0;
	let t1;
	let t2;
	let t3;
	let h3_class_value;
	let t4;
	let div0;
	let p;
	let t5_value = /*analysisResult*/ ctx[4].recommendation + "";
	let t5;
	let t6;
	let button;
	let t7;
	let div1_intro;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			h3 = element("h3");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(/*bloodSugar*/ ctx[3]);
			t3 = text(" mg/dL)");
			t4 = space();
			div0 = element("div");
			p = element("p");
			t5 = text(t5_value);
			t6 = space();
			button = element("button");
			t7 = text("Reset Analysis");
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h3 = claim_element(div1_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t0 = claim_text(h3_nodes, t0_value);
			t1 = claim_text(h3_nodes, " (");
			t2 = claim_text(h3_nodes, /*bloodSugar*/ ctx[3]);
			t3 = claim_text(h3_nodes, " mg/dL)");
			h3_nodes.forEach(detach);
			t4 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t5 = claim_text(p_nodes, t5_value);
			p_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			button = claim_element(div1_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t7 = claim_text(button_nodes, "Reset Analysis");
			button_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h3, "class", h3_class_value = "result-level " + /*analysisResult*/ ctx[4].level.toLowerCase() + " svelte-1qss0dm");
			attr(p, "class", "svelte-1qss0dm");
			attr(div0, "class", "result-content svelte-1qss0dm");
			attr(button, "class", "reset-btn svelte-1qss0dm");
			attr(div1, "class", "result-modal svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, h3);
			append_hydration(h3, t0);
			append_hydration(h3, t1);
			append_hydration(h3, t2);
			append_hydration(h3, t3);
			append_hydration(div1, t4);
			append_hydration(div1, div0);
			append_hydration(div0, p);
			append_hydration(p, t5);
			append_hydration(div1, t6);
			append_hydration(div1, button);
			append_hydration(button, t7);

			if (!mounted) {
				dispose = listen(button, "click", /*resetBloodTest*/ ctx[11]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*analysisResult*/ 16 && t0_value !== (t0_value = /*analysisResult*/ ctx[4].level + "")) set_data(t0, t0_value);
			if (dirty & /*bloodSugar*/ 8) set_data(t2, /*bloodSugar*/ ctx[3]);

			if (dirty & /*analysisResult*/ 16 && h3_class_value !== (h3_class_value = "result-level " + /*analysisResult*/ ctx[4].level.toLowerCase() + " svelte-1qss0dm")) {
				attr(h3, "class", h3_class_value);
			}

			if (dirty & /*analysisResult*/ 16 && t5_value !== (t5_value = /*analysisResult*/ ctx[4].recommendation + "")) set_data(t5, t5_value);
		},
		i(local) {
			if (!div1_intro) {
				add_render_callback(() => {
					div1_intro = create_in_transition(div1, fade, { duration: 300, easing: func_5 });
					div1_intro.start();
				});
			}
		},
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			mounted = false;
			dispose();
		}
	};
}

// (430:9) {#if accordionStates.breakfast}
function create_if_block_4(ctx) {
	let div;
	let p;
	let t_value = /*meals*/ ctx[6].breakfast + "";
	let t;
	let div_transition;
	let current;

	return {
		c() {
			div = element("div");
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "svelte-1qss0dm");
			attr(div, "class", "accordion-content svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func }, false);
			div_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching && div_transition) div_transition.end();
		}
	};
}

// (452:9) {#if accordionStates.lunch}
function create_if_block_3(ctx) {
	let div;
	let p;
	let t_value = /*meals*/ ctx[6].lunch[/*mealIndices*/ ctx[2].lunch] + "";
	let t;
	let div_transition;
	let current;

	return {
		c() {
			div = element("div");
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "svelte-1qss0dm");
			attr(div, "class", "accordion-content svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty & /*mealIndices*/ 4) && t_value !== (t_value = /*meals*/ ctx[6].lunch[/*mealIndices*/ ctx[2].lunch] + "")) set_data(t, t_value);
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_1 }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_1 }, false);
			div_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching && div_transition) div_transition.end();
		}
	};
}

// (467:9) {#if accordionStates.snack}
function create_if_block_2(ctx) {
	let div;
	let p;
	let t_value = /*meals*/ ctx[6].snack + "";
	let t;
	let div_transition;
	let current;

	return {
		c() {
			div = element("div");
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "preserve-newlines svelte-1qss0dm");
			attr(div, "class", "accordion-content svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_2 }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_2 }, false);
			div_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching && div_transition) div_transition.end();
		}
	};
}

// (489:9) {#if accordionStates.dinner}
function create_if_block_1(ctx) {
	let div;
	let p;
	let t_value = /*meals*/ ctx[6].dinner[/*mealIndices*/ ctx[2].dinner] + "";
	let t;
	let div_transition;
	let current;

	return {
		c() {
			div = element("div");
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "svelte-1qss0dm");
			attr(div, "class", "accordion-content svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty & /*mealIndices*/ 4) && t_value !== (t_value = /*meals*/ ctx[6].dinner[/*mealIndices*/ ctx[2].dinner] + "")) set_data(t, t_value);
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_3 }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300, easing: func_3 }, false);
			div_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching && div_transition) div_transition.end();
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div1;
	let div0;
	let button0;
	let svg0;
	let path0;
	let t0;
	let t1;
	let button1;
	let svg1;
	let path1;
	let t2;
	let t3;
	let current_block_type_index;
	let if_block;
	let current;
	let mounted;
	let dispose;
	const if_block_creators = [create_if_block, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*currentView*/ ctx[0] === 'meal') return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			section = element("section");
			div1 = element("div");
			div0 = element("div");
			button0 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t0 = text("\n       Meal Plan");
			t1 = space();
			button1 = element("button");
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			t2 = text("\n       Blood Test");
			t3 = space();
			if_block.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true });
			var section_nodes = children(section);
			div1 = claim_element(section_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			t0 = claim_text(button0_nodes, "\n       Meal Plan");
			button0_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			button1 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);

			svg1 = claim_svg_element(button1_nodes, "svg", {
				width: true,
				height: true,
				viewBox: true,
				fill: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			t2 = claim_text(button1_nodes, "\n       Blood Test");
			button1_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			if_block.l(div1_nodes);
			div1_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z");
			attr(svg0, "width", "20");
			attr(svg0, "height", "20");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "fill", "currentColor");
			attr(button0, "class", "toggle-btn svelte-1qss0dm");
			toggle_class(button0, "active", /*currentView*/ ctx[0] === 'meal');
			attr(path1, "d", "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z");
			attr(svg1, "width", "20");
			attr(svg1, "height", "20");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "fill", "currentColor");
			attr(button1, "class", "toggle-btn svelte-1qss0dm");
			toggle_class(button1, "active", /*currentView*/ ctx[0] === 'blood');
			attr(div0, "class", "view-toggle svelte-1qss0dm");
			attr(div1, "class", "container svelte-1qss0dm");
			attr(section, "class", "app svelte-1qss0dm");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div1);
			append_hydration(div1, div0);
			append_hydration(div0, button0);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			append_hydration(button0, t0);
			append_hydration(div0, t1);
			append_hydration(div0, button1);
			append_hydration(button1, svg1);
			append_hydration(svg1, path1);
			append_hydration(button1, t2);
			append_hydration(div1, t3);
			if_blocks[current_block_type_index].m(div1, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[13]),
					listen(button1, "click", /*click_handler_1*/ ctx[14])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*currentView*/ 1) {
				toggle_class(button0, "active", /*currentView*/ ctx[0] === 'meal');
			}

			if (!current || dirty & /*currentView*/ 1) {
				toggle_class(button1, "active", /*currentView*/ ctx[0] === 'blood');
			}

			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(div1, null);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(section);
			if_blocks[current_block_type_index].d();
			mounted = false;
			run_all(dispose);
		}
	};
}

const func = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_1 = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_2 = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_3 = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_4 = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_5 = t => t * t * t * (t * (t * 6 - 15) + 10);
const func_6 = t => t * t * t * (t * (t * 6 - 15) + 10);

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;

	// State management for current view ('meal' or 'blood')
	let currentView = 'meal';

	// State for accordion collapse/expand - all collapsed by default
	let accordionStates = {
		breakfast: false,
		lunch: false,
		snack: false,
		dinner: false
	};

	// State for meal shuffling (tracks current index for multi-option meals)
	let mealIndices = { lunch: 0, dinner: 0 };

	// Blood sugar analysis state
	let bloodSugar = '';

	let analysisResult = null;
	let showResult = false;

	// Meal data with exact specifications
	const meals = {
		breakfast: "1 slice whole-wheat toast + labna + goat cheese + cucumber slices + 1 orange (whole, not juice) + coffee with ½ cup skimmed milk",
		lunch: [
			"GAD: Grilled chicken + salad + small rice",
			"Al-Dahan: Shish tawook plate + salad + tahina + small rice",
			"Yemeni: Chicken mandi (small rice) + salad"
		],
		snack: "1 apple (daily)\nBefore gym/paddle: 2 dates OR ½ banana",
		dinner: [
			"Tuna salad (olive oil, lemon, cucumber, tomato) + 1 slice toast",
			"Greek yogurt (2%) + cucumber + olive oil",
			"Lentil soup + salad + 1 slice toast",
			"Grilled chicken breast with zucchini or spinach"
		]
	};

	// Functions
	function switchView(view) {
		$$invalidate(0, currentView = view);

		// Reset blood test state when switching views (stateless requirement)
		if (view === 'meal') {
			resetBloodTest();
		}
	}

	function toggleAccordion(meal) {
		$$invalidate(1, accordionStates[meal] = !accordionStates[meal], accordionStates);
	}

	function shuffleMeal(meal) {
		if (meals[meal] && Array.isArray(meals[meal])) {
			$$invalidate(2, mealIndices[meal] = (mealIndices[meal] + 1) % meals[meal].length, mealIndices);
		}
	}

	function analyzeReading() {
		const reading = parseFloat(bloodSugar);
		if (isNaN(reading)) return;

		if (reading < 70) {
			$$invalidate(4, analysisResult = {
				level: 'Low',
				recommendation: 'Eat 15g fast carbs, wait 15 min, recheck. If still low, repeat. Always carry quick sugar.'
			});
		} else if (reading >= 70 && reading <= 180) {
			$$invalidate(4, analysisResult = {
				level: 'Normal',
				recommendation: 'Proceed as planned with meals + insulin.'
			});
		} else {
			$$invalidate(4, analysisResult = {
				level: 'High',
				recommendation: 'Drink water, walk 10–15 min if possible, stick to protein + veggies + salad in next meal (low carb).'
			});
		}

		$$invalidate(5, showResult = true);
	}

	function resetBloodTest() {
		$$invalidate(3, bloodSugar = '');
		$$invalidate(4, analysisResult = null);
		$$invalidate(5, showResult = false);
	}

	const click_handler = () => switchView('meal');
	const click_handler_1 = () => switchView('blood');
	const click_handler_2 = () => toggleAccordion('breakfast');
	const click_handler_3 = () => shuffleMeal('lunch');
	const click_handler_4 = () => toggleAccordion('lunch');
	const click_handler_5 = () => toggleAccordion('snack');
	const click_handler_6 = () => shuffleMeal('dinner');
	const click_handler_7 = () => toggleAccordion('dinner');

	function input_input_handler() {
		bloodSugar = to_number(this.value);
		$$invalidate(3, bloodSugar);
	}

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(12, props = $$props.props);
	};

	return [
		currentView,
		accordionStates,
		mealIndices,
		bloodSugar,
		analysisResult,
		showResult,
		meals,
		switchView,
		toggleAccordion,
		shuffleMeal,
		analyzeReading,
		resetBloodTest,
		props,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4,
		click_handler_5,
		click_handler_6,
		click_handler_7,
		input_input_handler
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 12 });
	}
}

export { Component as default };
