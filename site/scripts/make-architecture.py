"""Architecture diagrams for the project pages, in the diagram-design skill's Architecture type.

Skinned with the site's own tokens (dark ink, Space Grotesk, neon white for the 1-2 focal nodes) instead of
the skill's defaults. Every label comes from facts already on that project's page; nothing names a platform
or technique the project notes marked "confirm first".

Layout is a grid: nodes sit in columns and rows, and connectors follow the skill's rules: straight when both
ends share a row or column, otherwise one rounded right-angle bend entering through the top or bottom, labels
on an opaque mask clear of their stroke, and one attach point per connector on a shared edge.

Usage: python3 scripts/make-architecture.py [preview-dir]
Writes src/assets/work/architecture/<slug>-architecture.svg, and with preview-dir, one standalone HTML per
diagram for the skill's self_check.py.
"""
import html
import sys
from pathlib import Path

PAPER, INK, MUTED, SOFT, NEON = '#0d0c0b', '#f3eee4', '#a9a49b', 'rgba(243,238,228,0.45)', '#f4f8ff'
FONT = "'Space Grotesk', system-ui, sans-serif"
W, H, GAP_X, GAP_Y, LEFT, TOP, R = 144, 64, 80, 48, 40, 64, 8

# Node: (id, col, row, tag, name, sublabel, focal). Edge: (from, to, label, dashed).
DIAGRAMS = {
    'document-assistant': dict(
        title='AI document assistant', desc='Consultants add notes, research and reports through the assistant, which files them under one shared record per client so colleagues can find earlier work.',
        nodes=[('team', 0, 0, 'IN', 'Consultants', 'notes · research · reports', False),
               ('assistant', 1, 0, 'AI', 'Document assistant', 'organises by client', False),
               ('record', 2, 0, 'STORE', 'Shared client record', 'one per client', True),
               ('colleagues', 3, 0, 'OUT', 'Colleagues', 'find earlier work', False)],
        edges=[('team', 'assistant', 'ADD', False), ('assistant', 'record', 'FILE', False), ('record', 'colleagues', 'FIND', False)]),
    'voice-receptionist': dict(
        title='AI voice receptionist', desc='A caller reaches one shared voice receptionist, which checks availability across locations and routes table bookings to the right front desk and catering bookings to the owner.',
        nodes=[('caller', 0, 1, 'IN', 'Caller', 'one call', False),
               ('voice', 1, 1, 'AI', 'Voice receptionist', 'answers · books', True),
               ('bookings', 2, 0, 'STORE', 'Booking systems', 'one per location', False),
               ('desk', 2, 1, 'OUT', 'Front desk', 'the right location', False),
               ('owner', 2, 2, 'OUT', 'Catering owner', 'requirements captured', False)],
        edges=[('caller', 'voice', '', False), ('voice', 'bookings', 'AVAILABILITY', False),
               ('voice', 'desk', 'TABLE', False), ('voice', 'owner', 'CATERING', False)]),
    'invoice-processing': dict(
        title='AI invoice processing', desc='The assistant reads incoming invoices, files them, flags the ones needing review and prepares emails that stay in drafts until an admin approves them.',
        nodes=[('invoices', 0, 1, 'IN', 'Incoming invoices', 'PDFs · photos', False),
               ('assistant', 1, 1, 'AI', 'Invoice assistant', 'reads · files · flags', False),
               ('records', 2, 0, 'STORE', 'Invoice records', 'filed where they belong', False),
               ('drafts', 2, 1, 'DRAFT', 'Draft emails', 'wait in drafts', False),
               ('admin', 3, 1, 'HUMAN', 'Admin', 'reviews · approves', True),
               ('sent', 4, 1, 'OUT', 'Sent email', 'after approval', False)],
        edges=[('invoices', 'assistant', '', False), ('assistant', 'records', 'FILE', False), ('assistant', 'drafts', 'PREPARE', False),
               ('drafts', 'admin', 'REVIEW', False), ('admin', 'sent', 'APPROVE', False)]),
    'research-assistant': dict(
        title='AI research assistant', desc='Search runs only on request and saves sources with their details; answers come only from that collection, citing the evidence or reporting that support is missing.',
        nodes=[('team', 0, 1, 'IN', 'Research team', 'requests · questions', False),
               ('search', 1, 0, 'AI', 'Search on request', 'finds sources', False),
               ('collection', 2, 0, 'STORE', 'Source collection', 'saved with source details', False),
               ('answer', 2, 1, 'AI', 'Answering step', 'only from the collection', True),
               ('cited', 3, 1, 'OUT', 'Cited answer', 'linked to its source', False),
               ('gap', 3, 2, 'OUT', 'Evidence gap', 'says support is missing', False)],
        edges=[('team', 'search', 'SEARCH', False), ('search', 'collection', 'SAVE', False), ('team', 'answer', 'ASK', False),
               ('collection', 'answer', 'CHECK', False), ('answer', 'cited', 'CITE', False), ('answer', 'gap', 'NO SUPPORT', True)]),
    'philanthropel': dict(
        title='Philanthropel', desc="Agents are built with the organisation, on the organisation's own data, and stay with them to run afterwards.",
        zone=('THEIRS', 0, 2, 1, 1),
        nodes=[('studio', 1, 0, 'EXT', 'Philanthropel', 'builds with them', False),
               ('data', 0, 1, 'STORE', 'Their data', 'stays theirs', False),
               ('agents', 1, 1, 'AI', 'Agents', 'built with them', True),
               ('team', 2, 1, 'OUT', 'Their team', 'theirs to run afterwards', False)],
        edges=[('studio', 'agents', 'BUILD WITH', True), ('data', 'agents', '', False), ('agents', 'team', 'RUN', False)]),
    'penname': dict(
        title='Penname', desc='On the device, Penname gives every private detail a stand-in and keeps an encrypted key; only the safe copy goes to an AI assistant, and the reply comes back with the real details restored.',
        zone=('ON YOUR DEVICE', 0, 2, 0, 1),
        nodes=[('doc', 0, 0, 'IN', 'Confidential document', 'real details', False),
               ('penname', 1, 0, 'APP', 'Penname', 'spots details offline', True),
               ('safe', 2, 0, 'OUT', 'Safe copy', 'stand-ins only', False),
               ('ai', 3, 0, 'EXT', 'AI assistant', 'ChatGPT · Claude · Copilot', False),
               ('key', 1, 1, 'STORE', 'Key file', 'encrypted · stays with you', False),
               ('restored', 2, 1, 'OUT', 'Restored reply', 'real details back', False)],
        edges=[('doc', 'penname', '', False), ('penname', 'safe', 'STAND-INS', False), ('safe', 'ai', 'SHARE', False),
               ('penname', 'key', '', False), ('ai', 'restored', 'REPLY', True), ('key', 'restored', 'RESTORE', False)]),
    'digital-feasibility-study': dict(
        title='Digital Feasibility Study', desc='Many donor records feed three agents, whose work combines into one feasibility report.',
        nodes=[('donors', 0, 1, 'IN', 'Many donors', 'donor records', False),
               ('a1', 1, 0, 'AI', 'Agent', 'one of three', False),
               ('a2', 1, 1, 'AI', 'Agent', 'one of three', False),
               ('a3', 1, 2, 'AI', 'Agent', 'one of three', False),
               ('report', 2, 1, 'OUT', 'Feasibility report', 'one per engagement', True)],
        edges=[('donors', 'a1', '', False), ('donors', 'a2', '', False), ('donors', 'a3', '', False),
               ('a1', 'report', '', False), ('a2', 'report', '', False), ('a3', 'report', '', False)]),
    'proposal-system': dict(
        title='Proposal system', desc='A client brief goes through brief analysis and drafting agents and comes out as a client-ready proposal in about seven minutes.',
        nodes=[('brief', 0, 0, 'IN', 'Client brief', 'from the client', False),
               ('analysis', 1, 0, 'AI', 'Brief analysis', 'reads the brief', False),
               ('drafting', 2, 0, 'AI', 'Drafting agents', 'write the proposal', True),
               ('proposal', 3, 0, 'OUT', 'Client-ready proposal', 'about seven minutes', False)],
        edges=[('brief', 'analysis', '', False), ('analysis', 'drafting', '', False), ('drafting', 'proposal', '', False)]),
}


def esc(text):
    return html.escape(text, quote=True)


def box(col, row):
    x, y = LEFT + col * (W + GAP_X), TOP + row * (H + GAP_Y)
    return dict(x=x, y=y, cx=x + W / 2, cy=y + H / 2, r=x + W, b=y + H)


def label_svg(x, y, text, focal, anchor='middle'):
    """An arrow label on an opaque paper mask; (x, y) is the text baseline centre."""
    width = len(text) * 6.2 + 10
    left = x - width / 2 if anchor == 'middle' else x - 5
    colour = NEON if focal else MUTED
    return (f'<rect x="{left:.1f}" y="{y - 9:.1f}" width="{width:.1f}" height="12" rx="2" fill="{PAPER}"/>'
            f'<text x="{x:.1f}" y="{y:.1f}" fill="{colour}" font-size="8" font-weight="500" font-family="{FONT}" text-anchor="{anchor}" letter-spacing="0.08em">{esc(text)}</text>')


def ports(edges, nodes):
    """One attach point per connector on each node edge, spread at L*k/(N+1), ordered so routes don't cross."""
    sides = {}
    for i, (a, b, *_rest) in enumerate(edges):
        na, nb = nodes[a], nodes[b]
        if na['col'] == nb['col']:
            out_side, in_side = ('bottom', 'top') if nb['row'] > na['row'] else ('top', 'bottom')
        elif nb['col'] > na['col']:
            if na['row'] == nb['row']:
                out_side, in_side = 'right', 'left'
            elif any(n['col'] == nb['col'] and n['row'] == na['row'] for n in nodes.values()):
                # a node sits where the run would turn, so go up or down out of the source first, then across
                out_side, in_side = ('top' if nb['row'] < na['row'] else 'bottom'), 'left'
            else:
                out_side, in_side = 'right', ('bottom' if nb['row'] < na['row'] else 'top')
        else:  # a return to the left: leave through the bottom, arrive through the right side
            out_side, in_side = 'bottom', 'right'
        sides.setdefault((a, out_side), []).append((i, 'out', b))
        sides.setdefault((b, in_side), []).append((i, 'in', a))
    placed = {}
    for (node, side), items in sides.items():
        horizontal = side in ('top', 'bottom')
        key = (lambda it: nodes[it[2]]['col']) if horizontal else (lambda it: nodes[it[2]]['row'])
        items.sort(key=key)
        n = nodes[node]
        for k, (i, way, _other) in enumerate(items, 1):
            if horizontal:
                at = (n['x'] + W * k / (len(items) + 1), n['b'] if side == 'bottom' else n['y'])
            else:
                at = (n['r'] if side == 'right' else n['x'], n['y'] + H * k / (len(items) + 1))
            placed[(i, way)] = (side, at)
    return placed


def connector(i, edge, nodes, placed):
    a, b, text, dashed = edge
    focal = False  # the accent stays on the 1-2 focal nodes; every connector is muted
    stroke, marker = MUTED, 'arrow'
    (out_side, (x1, y1)), (in_side, (x2, y2)) = placed[(i, 'out')], placed[(i, 'in')]
    lab = ''
    if out_side == 'right' and in_side == 'left':
        y2 = y1  # a straight run: both ends share the row, so the destination port follows the source
        d = f'M {x1:.1f},{y1:.1f} H {x2:.1f}'
        if text:
            lab = label_svg((x1 + x2) / 2, y1 - 10, text, focal)
    elif out_side == 'right':  # one bend, entering the destination through its top or bottom
        up = in_side == 'bottom'
        s = -1 if up else 1
        d = f'M {x1:.1f},{y1:.1f} H {x2 - R:.1f} Q {x2:.1f},{y1:.1f} {x2:.1f},{y1 + s * R:.1f} V {y2:.1f}'
        if text:
            lab = label_svg(x2 + 8, (y1 + y2) / 2 + 3, text, focal, anchor='start')
    elif out_side in ('top', 'bottom') and in_side == 'left':  # vertical first, then across into the side
        s = -1 if out_side == 'top' else 1
        d = f'M {x1:.1f},{y1:.1f} V {y2 - s * R:.1f} Q {x1:.1f},{y2:.1f} {x1 + R:.1f},{y2:.1f} H {x2:.1f}'
        if text:
            lab = label_svg((x1 + x2) / 2 + 4, y2 - 10, text, focal)
    elif out_side in ('top', 'bottom') and in_side in ('top', 'bottom'):
        x2 = x1
        d = f'M {x1:.1f},{y1:.1f} V {y2:.1f}'
        if text:
            lab = label_svg(x1 + 8, (y1 + y2) / 2 + 3, text, focal, anchor='start')
    else:  # down out of the source's bottom, then left into the destination's right side
        d = f'M {x1:.1f},{y1:.1f} V {y2 - R:.1f} Q {x1:.1f},{y2:.1f} {x1 - R:.1f},{y2:.1f} H {x2:.1f}'
        if text:
            lab = label_svg(x1 + 8, (y1 + y2) / 2 - 4, text, focal, anchor='start')
    dash = ' stroke-dasharray="4,3"' if dashed else ''
    width = '1' if dashed else ('1.4' if focal else '1.2')
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}"{dash} marker-end="url(#{marker})"/>', lab


def node_svg(n):
    x, y, focal = n['x'], n['y'], n['focal']
    fill = 'rgba(244,248,255,0.07)' if focal else 'rgba(243,238,228,0.03)'
    stroke = NEON if focal else 'rgba(243,238,228,0.30)'
    glow = ' filter="url(#neon-glow)"' if focal else ''
    tag_w = len(n['tag']) * 5.6 + 10
    tag_colour = NEON if focal else MUTED
    return (f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="6" fill="{PAPER}"/>'
            f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"{glow}/>'
            f'<rect x="{x + 8}" y="{y + 8}" width="{tag_w:.1f}" height="12" rx="2" fill="none" stroke="{tag_colour}" stroke-opacity="0.5" stroke-width="0.8"/>'
            f'<text x="{x + 8 + tag_w / 2:.1f}" y="{y + 17}" fill="{tag_colour}" font-size="7" font-weight="500" font-family="{FONT}" text-anchor="middle" letter-spacing="0.08em">{esc(n["tag"])}</text>'
            f'<text x="{n["cx"]}" y="{y + 40}" fill="{INK}" font-size="12" font-weight="700" font-family="{FONT}" text-anchor="middle">{esc(n["name"])}</text>'
            f'<text x="{n["cx"]}" y="{y + 54}" fill="{MUTED}" font-size="9" font-weight="400" font-family="{FONT}" text-anchor="middle">{esc(n["sub"])}</text>')


def zone_svg(zone):
    name, c0, c1, r0, r1 = zone
    x, y = LEFT + c0 * (W + GAP_X) - 20, TOP + r0 * (H + GAP_Y) - 32
    w = (c1 - c0) * (W + GAP_X) + W + 40
    h = (r1 - r0) * (H + GAP_Y) + H + 52
    lw = len(name) * 5.4 + 14
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(243,238,228,0.02)" stroke="rgba(243,238,228,0.14)" stroke-width="0.8" stroke-dasharray="5,4"/>'
            f'<rect x="{x + 12}" y="{y + 4}" width="{lw:.1f}" height="12" rx="2" fill="{PAPER}"/>'
            f'<text x="{x + 12 + lw / 2:.1f}" y="{y + 13}" fill="{SOFT}" font-size="7" font-weight="500" font-family="{FONT}" text-anchor="middle" letter-spacing="0.14em">{esc(name)}</text>')


def diagram(slug, spec):
    nodes = {}
    for nid, col, row, tag, name, sub, focal in spec['nodes']:
        nodes[nid] = dict(col=col, row=row, tag=tag, name=name, sub=sub, focal=focal, **box(col, row))
    cols = max(n['col'] for n in nodes.values()) + 1
    rows = max(n['row'] for n in nodes.values()) + 1
    width = max(1000, LEFT * 2 + cols * W + (cols - 1) * GAP_X)
    height = TOP + rows * H + (rows - 1) * GAP_Y + 40
    shift = (width - (LEFT * 2 + cols * W + (cols - 1) * GAP_X)) / 2  # centre narrow diagrams in the frame
    for n in nodes.values():
        for k in ('x', 'cx', 'r'):
            n[k] += shift
    placed = ports(spec['edges'], nodes)
    paths, labels = zip(*(connector(i, e, nodes, placed) for i, e in enumerate(spec['edges'])))
    zone = zone_svg_shifted(spec['zone'], shift) if 'zone' in spec else ''
    sid = f'{slug}-architecture'
    return (f'<svg viewBox="0 0 {width:.0f} {height:.0f}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{sid}-title {sid}-desc" class="architecture" style="min-width:{width:.0f}px">'
            f'<title id="{sid}-title">{esc(spec["title"])}: how it fits together</title>'
            f'<desc id="{sid}-desc">{esc(spec["desc"])}</desc>'
            f'<defs><marker id="{sid}-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>'
            f'<marker id="{sid}-arrow-neon" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{NEON}"/></marker>'
            f'<filter id="{sid}-neon-glow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="{NEON}" flood-opacity="0.45"/></filter></defs>'
            + zone
            + ''.join(paths).replace('url(#arrow-neon)', f'url(#{sid}-arrow-neon)').replace('url(#arrow)', f'url(#{sid}-arrow)')
            + ''.join(labels)
            + ''.join(node_svg(n) for n in nodes.values()).replace('url(#neon-glow)', f'url(#{sid}-neon-glow)')
            + '</svg>')


def zone_svg_shifted(zone, shift):
    name, c0, c1, r0, r1 = zone
    svg = zone_svg(zone)
    x = LEFT + c0 * (W + GAP_X) - 20
    w = (c1 - c0) * (W + GAP_X) + W + 40
    lw = len(name) * 5.4 + 14
    return (svg.replace(f'<rect x="{x}"', f'<rect x="{x + shift:.1f}"', 1)
               .replace(f'<rect x="{x + 12}"', f'<rect x="{x + shift + 12:.1f}"', 1)
               .replace(f'<text x="{x + 12 + lw / 2:.1f}"', f'<text x="{x + shift + 12 + lw / 2:.1f}"', 1))


def page(slug, svg, title):
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
            f'<title>{esc(title)}</title><style>body{{margin:0;background:{PAPER};color:{INK};font-family:{FONT};padding:3rem 2rem}}'
            f'.diagram-container{{width:100%;overflow-x:auto}}svg{{width:100%;display:block}}</style></head>'
            f'<body><p>Architecture · {esc(title)}</p><div class="diagram-container">{svg}</div></body></html>')


def main():
    out = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'work' / 'architecture'
    out.mkdir(parents=True, exist_ok=True)
    preview = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for slug, spec in DIAGRAMS.items():
        svg = diagram(slug, spec)
        assert len(spec['nodes']) <= 9 and len(spec['edges']) <= 12, f'{slug} is over the complexity budget'
        assert sum(n[6] for n in spec['nodes']) <= 2, f'{slug} has more than two focal nodes'
        (out / f'{slug}-architecture.svg').write_text(svg)
        if preview:
            preview.mkdir(parents=True, exist_ok=True)
            (preview / f'{slug}-architecture.html').write_text(page(slug, svg, spec['title']))
    print(f'Wrote {len(DIAGRAMS)} diagrams to {out}')


if __name__ == '__main__':
    main()
