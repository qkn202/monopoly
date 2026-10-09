import bpy
import math
import os

def run():
    print("=== STARTING BLENDER 3D BOARD GENERATION ===")
    
    # 1. Reset scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "HogwartsMonopolyScene"
    
    # 2. Material Helper
    def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5, emission_color=None, emission_strength=1.0):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = base_color
            bsdf.inputs['Metallic'].default_value = metallic
            bsdf.inputs['Roughness'].default_value = roughness
            if emission_color:
                bsdf.inputs['Emission Color'].default_value = emission_color
                bsdf.inputs['Emission Strength'].default_value = emission_strength
        return mat

    # Materials Palette - Neo-Wizarding Modern Luxury
    m_obsidian = create_pbr_material("M_Obsidian", (0.015, 0.018, 0.024, 1.0), metallic=0.2, roughness=0.15)
    m_obsidian_rough = create_pbr_material("M_Obsidian_Matte", (0.02, 0.025, 0.035, 1.0), metallic=0.1, roughness=0.45)
    m_gold_trim = create_pbr_material("M_Gold_Trim", (0.88, 0.72, 0.32, 1.0), metallic=0.95, roughness=0.18)
    m_tile_plinth = create_pbr_material("M_Tile_Plinth", (0.045, 0.05, 0.065, 1.0), metallic=0.15, roughness=0.25)
    m_tile_border = create_pbr_material("M_Tile_Border", (0.08, 0.09, 0.12, 1.0), metallic=0.4, roughness=0.3)
    
    # Glowing Runes & Arcane Inlays
    m_rune_cyan = create_pbr_material("M_Rune_Cyan", (0.0, 0.85, 1.0, 1.0), emission_color=(0.0, 0.85, 1.0, 1.0), emission_strength=5.0)
    m_rune_gold = create_pbr_material("M_Rune_Gold", (1.0, 0.75, 0.2, 1.0), emission_color=(1.0, 0.75, 0.2, 1.0), emission_strength=4.5)
    
    # 8 Player Crystals
    player_crystal_colors = [
        ("M_Crystal_P1_Ruby", (1.0, 0.08, 0.15, 1.0), 6.0),
        ("M_Crystal_P2_Emerald", (0.05, 0.95, 0.35, 1.0), 6.0),
        ("M_Crystal_P3_Sapphire", (0.1, 0.45, 1.0, 1.0), 6.0),
        ("M_Crystal_P4_Topaz", (1.0, 0.68, 0.05, 1.0), 6.0),
        ("M_Crystal_P5_Amethyst", (0.75, 0.12, 0.98, 1.0), 6.0),
        ("M_Crystal_P6_Turquoise", (0.05, 0.9, 0.95, 1.0), 6.0),
        ("M_Crystal_P7_Silver", (0.9, 0.95, 1.0, 1.0), 4.5),
        ("M_Crystal_P8_RoseGold", (1.0, 0.35, 0.55, 1.0), 6.0),
    ]
    player_mats = [create_pbr_material(name, col, emission_color=col, emission_strength=strg) for name, col, strg in player_crystal_colors]

    # Property Group Colors
    group_colors = {
        'brown': create_pbr_material("M_Grp_Brown", (0.35, 0.18, 0.08, 1.0), metallic=0.3, roughness=0.3),
        'lightblue': create_pbr_material("M_Grp_LightBlue", (0.15, 0.6, 0.95, 1.0), metallic=0.3, roughness=0.25),
        'pink': create_pbr_material("M_Grp_Pink", (0.9, 0.2, 0.65, 1.0), metallic=0.3, roughness=0.25),
        'orange': create_pbr_material("M_Grp_Orange", (0.98, 0.45, 0.05, 1.0), metallic=0.3, roughness=0.25),
        'red': create_pbr_material("M_Grp_Red", (0.88, 0.08, 0.12, 1.0), metallic=0.3, roughness=0.25),
        'yellow': create_pbr_material("M_Grp_Yellow", (0.98, 0.8, 0.08, 1.0), metallic=0.3, roughness=0.25),
        'green': create_pbr_material("M_Grp_Green", (0.06, 0.6, 0.22, 1.0), metallic=0.3, roughness=0.25),
        'darkblue': create_pbr_material("M_Grp_DarkBlue", (0.05, 0.18, 0.75, 1.0), metallic=0.3, roughness=0.2),
        'station': create_pbr_material("M_Grp_Station", (0.7, 0.72, 0.78, 1.0), metallic=0.8, roughness=0.2),
        'utility': create_pbr_material("M_Grp_Utility", (0.0, 0.8, 0.85, 1.0), metallic=0.5, roughness=0.3),
        'card_chance': create_pbr_material("M_Grp_Chance", (0.6, 0.15, 0.8, 1.0), metallic=0.4, roughness=0.3),
        'card_comm': create_pbr_material("M_Grp_Community", (0.85, 0.65, 0.1, 1.0), metallic=0.5, roughness=0.3),
        'corner_go': create_pbr_material("M_Corner_GO", (0.7, 0.1, 0.15, 1.0), metallic=0.4, roughness=0.25),
        'corner_azkaban': create_pbr_material("M_Corner_Azkaban", (0.1, 0.12, 0.16, 1.0), metallic=0.7, roughness=0.3),
        'corner_park': create_pbr_material("M_Corner_Parking", (0.08, 0.45, 0.2, 1.0), metallic=0.4, roughness=0.25),
        'corner_goto': create_pbr_material("M_Corner_GoToJail", (0.5, 0.2, 0.05, 1.0), metallic=0.4, roughness=0.25),
    }

    # 3. Helpers to spawn geometry
    def add_box(name, loc, size, mat):
        # size is (dx, dy, dz)
        bpy.ops.mesh.primitive_cube_add(location=(loc[0], loc[1], loc[2] + size[2]/2.0))
        box = bpy.context.active_object
        box.name = name
        box.scale = (size[0]/2.0, size[1]/2.0, size[2]/2.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if mat:
            box.data.materials.append(mat)
        return box

    def add_cylinder(name, loc, radius, depth, mat):
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=(loc[0], loc[1], loc[2] + depth/2.0), vertices=32)
        cyl = bpy.context.active_object
        cyl.name = name
        if mat:
            cyl.data.materials.append(mat)
        return cyl

    def add_crystal(name, loc, size, mat):
        # Faceted gemstone mana crystal (icosahedron diamond)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(loc[0], loc[1], loc[2]))
        crys = bpy.context.active_object
        crys.name = name
        crys.scale = (0.8, 0.8, 1.5)
        bpy.ops.object.transform_apply(scale=True)
        if mat:
            crys.data.materials.append(mat)
        return crys

    # Root Collection
    board_collection = bpy.data.collections.new("HogwartsBoard")
    bpy.context.scene.collection.children.link(board_collection)

    # 4. CHASSIS / BASE PEDESTAL
    print("Building Base Chassis...")
    # Main outer obsidian slab
    add_box("Base_Plinth_Main", (0, 0, 0), (11.8, 11.8, 0.35), m_obsidian)
    # Beveled gold rim
    add_box("Base_Gold_Trim_Outer", (0, 0, 0.35), (11.85, 11.85, 0.05), m_gold_trim)
    # Inner stepped chassis
    add_box("Base_Plinth_Inner", (0, 0, 0.40), (10.4, 10.4, 0.06), m_obsidian_rough)
    # Gold border framing the 40-tile track
    add_box("Track_Gold_Frame", (0, 0, 0.46), (10.05, 10.05, 0.02), m_gold_trim)

    # 5. 8 PLAYER DOCKS (2 on each of 4 sides)
    print("Building 8 Player Docks...")
    dock_offsets = [
        # South side (P1, P2)
        ("P1", (-2.3, -5.6, 0.1), 0, player_mats[0]),
        ("P2", ( 2.3, -5.6, 0.1), 0, player_mats[1]),
        # West side (P3, P4)
        ("P3", (-5.6, -2.3, 0.1), 90, player_mats[2]),
        ("P4", (-5.6,  2.3, 0.1), 90, player_mats[3]),
        # North side (P5, P6)
        ("P5", (-2.3,  5.6, 0.1), 180, player_mats[4]),
        ("P6", ( 2.3,  5.6, 0.1), 180, player_mats[5]),
        # East side (P7, P8)
        ("P7", ( 5.6, -2.3, 0.1), 270, player_mats[6]),
        ("P8", ( 5.6,  2.3, 0.1), 270, player_mats[7]),
    ]

    for p_id, pos, rot_deg, crys_mat in dock_offsets:
        rot_rad = math.radians(rot_deg)
        # Dock Tray
        dock_w, dock_d, dock_h = 1.6, 0.65, 0.18
        if rot_deg in (90, 270):
            dock_w, dock_d = dock_d, dock_w
        add_box(f"Dock_{p_id}_Base", pos, (dock_w, dock_d, dock_h), m_obsidian)
        add_box(f"Dock_{p_id}_Rim", (pos[0], pos[1], pos[2] + dock_h), (dock_w * 0.95, dock_d * 0.95, 0.03), m_gold_trim)
        # Inset character card slot
        add_box(f"Dock_{p_id}_CardSlot", (pos[0], pos[1], pos[2] + dock_h + 0.02), (dock_w * 0.7, dock_d * 0.65, 0.02), m_obsidian_rough)
        # Floating Mana Crystal for this player
        crys = add_crystal(f"Crystal_{p_id}", (pos[0], pos[1], pos[2] + dock_h + 0.22), 0.12, crys_mat)
        crys.rotation_euler = (math.radians(15), math.radians(20), rot_rad)

    # 6. 40 MODULAR TILES (With Double-Lane grooves and Property Colors)
    print("Building 40 Modular Property Tiles...")
    
    # Mapping tiles 0..39 to their type / color group
    tile_meta = {
        0:  ('corner', 'corner_go', "Platform 9 3/4"),
        1:  ('property', 'brown', "Leaky Cauldron"),
        2:  ('card', 'card_comm', "Spells & Curses"),
        3:  ('property', 'brown', "Diagon Entrance"),
        4:  ('tax', 'station', "Ministry Galleon Tax"),
        5:  ('station', 'station', "Hogwarts Express"),
        6:  ('property', 'lightblue', "Flourish & Blotts"),
        7:  ('card', 'card_chance', "Portkey Draw"),
        8:  ('property', 'lightblue', "Eeylops Owl"),
        9:  ('property', 'lightblue', "Potages Cauldron"),
        10: ('corner', 'corner_azkaban', "Azkaban Fortress"),
        11: ('property', 'pink', "Madame Malkins"),
        12: ('utility', 'utility', "Floo Network"),
        13: ('property', 'pink', "Twilfitt & Tatting"),
        14: ('property', 'pink', "Ollivanders Wands"),
        15: ('station', 'station', "Knight Bus"),
        16: ('property', 'orange', "Zonkos Joke Shop"),
        17: ('card', 'card_comm', "Spells & Curses"),
        18: ('property', 'orange', "Weasleys Wizard Wheezes"),
        19: ('property', 'orange', "Knockturn Alley"),
        20: ('corner', 'corner_park', "Flying Ford Anglia"),
        21: ('property', 'red', "Honeydukes Sweets"),
        22: ('card', 'card_chance', "Portkey Draw"),
        23: ('property', 'red', "The Three Broomsticks"),
        24: ('property', 'red', "The Hogs Head"),
        25: ('station', 'station', "Portkey Network"),
        26: ('property', 'yellow', "Shrieking Shack"),
        27: ('property', 'yellow', "Hogsmeade Post Office"),
        28: ('utility', 'utility', "Daily Prophet Press"),
        29: ('property', 'yellow', "Scrivenshafts Quill"),
        30: ('corner', 'corner_goto', "Dementors Arrest"),
        31: ('property', 'green', "Godrics Hollow"),
        32: ('property', 'green', "Grimmauld Place"),
        33: ('card', 'card_comm', "Spells & Curses"),
        34: ('property', 'green', "Malfoy Manor"),
        35: ('station', 'station', "Broomstick Flightway"),
        36: ('card', 'card_chance', "Portkey Draw"),
        37: ('property', 'darkblue', "Gringotts Wizarding Bank"),
        38: ('tax', 'station', "Wizengamot Fine"),
        39: ('property', 'darkblue', "Ministry of Magic HQ"),
    }

    # Corner positions: size 1.4 x 1.4, centered at (+-4.3, +-4.3)
    corners = {
        0:  ( 4.3, -4.3),
        10: (-4.3, -4.3),
        20: (-4.3,  4.3),
        30: ( 4.3,  4.3),
    }

    # Generate positions for all 40 tiles
    for idx in range(40):
        t_type, t_group, t_name = tile_meta[idx]
        
        if idx in corners:
            # Corner Tile (Elevated Bastion Pillar)
            cx, cy = corners[idx]
            c_mat = group_colors.get(t_group, m_obsidian)
            # Base Plinth
            add_box(f"Tile_{idx}_Corner_Base", (cx, cy, 0.48), (1.38, 1.38, 0.16), m_tile_plinth)
            # Raised Podium
            add_box(f"Tile_{idx}_Corner_Top", (cx, cy, 0.64), (1.28, 1.28, 0.04), c_mat)
            # Corner Trim
            add_box(f"Tile_{idx}_Corner_Trim", (cx, cy, 0.68), (1.18, 1.18, 0.02), m_gold_trim)
            # Glowing corner beacon ring
            add_cylinder(f"Tile_{idx}_Corner_Beacon", (cx, cy, 0.70), 0.4, 0.015, m_rune_gold)
            
            # Special Corner Mini-Structures:
            if idx == 0: # Platform 9 3/4 Archway
                add_box("Arch_Left", (cx - 0.35, cy, 0.71), (0.16, 0.4, 0.45), m_obsidian)
                add_box("Arch_Right", (cx + 0.35, cy, 0.71), (0.16, 0.4, 0.45), m_obsidian)
                add_box("Arch_Top", (cx, cy, 1.15), (0.86, 0.4, 0.14), m_gold_trim)
            elif idx == 10: # Azkaban Fortress Tower
                add_box("Azkaban_Spire_1", (cx - 0.25, cy - 0.25, 0.71), (0.2, 0.2, 0.55), m_obsidian)
                add_box("Azkaban_Spire_2", (cx + 0.25, cy + 0.25, 0.71), (0.2, 0.2, 0.65), m_obsidian)
                add_box("Azkaban_Rune", (cx, cy, 0.71), (0.35, 0.35, 0.02), m_rune_cyan)
        else:
            # Regular Tile (9 per side)
            if 1 <= idx <= 9:
                # South: right to left
                step = idx - 1
                tx = 3.2 - step * 0.8
                ty = -4.3
                w, d = 0.76, 1.36
                color_band_pos = (tx, ty + 0.45, 0.62)
                color_band_size = (0.72, 0.28, 0.03)
                groove_pos1 = (tx - 0.18, ty - 0.1, 0.61)
                groove_pos2 = (tx + 0.18, ty - 0.1, 0.61)
                groove_size = (0.28, 0.75, 0.01)
            elif 11 <= idx <= 19:
                # West: bottom to top
                step = idx - 11
                tx = -4.3
                ty = -3.2 + step * 0.8
                w, d = 1.36, 0.76
                color_band_pos = (tx + 0.45, ty, 0.62)
                color_band_size = (0.28, 0.72, 0.03)
                groove_pos1 = (tx - 0.1, ty - 0.18, 0.61)
                groove_pos2 = (tx - 0.1, ty + 0.18, 0.61)
                groove_size = (0.75, 0.28, 0.01)
            elif 21 <= idx <= 29:
                # North: left to right
                step = idx - 21
                tx = -3.2 + step * 0.8
                ty = 4.3
                w, d = 0.76, 1.36
                color_band_pos = (tx, ty - 0.45, 0.62)
                color_band_size = (0.72, 0.28, 0.03)
                groove_pos1 = (tx - 0.18, ty + 0.1, 0.61)
                groove_pos2 = (tx + 0.18, ty + 0.1, 0.61)
                groove_size = (0.28, 0.75, 0.01)
            else: # 31 <= idx <= 39
                # East: top to bottom
                step = idx - 31
                tx = 4.3
                ty = 3.2 - step * 0.8
                w, d = 1.36, 0.76
                color_band_pos = (tx - 0.45, ty, 0.62)
                color_band_size = (0.28, 0.72, 0.03)
                groove_pos1 = (tx + 0.1, ty - 0.18, 0.61)
                groove_pos2 = (tx + 0.1, ty + 0.18, 0.61)
                groove_size = (0.75, 0.28, 0.01)

            # Plinth Body
            add_box(f"Tile_{idx}_{t_type}", (tx, ty, 0.48), (w, d, 0.12), m_tile_plinth)
            # Gold perimeter line on tile
            add_box(f"Tile_{idx}_Rim", (tx, ty, 0.59), (w * 0.96, d * 0.96, 0.015), m_tile_border)
            
            # Double-lane grooves for up to 8 tokens
            add_box(f"Tile_{idx}_Lane1", groove_pos1, groove_size, m_obsidian)
            add_box(f"Tile_{idx}_Lane2", groove_pos2, groove_size, m_obsidian)

            # Property Color Band
            grp_mat = group_colors.get(t_group, m_gold_trim)
            add_box(f"Tile_{idx}_ColorBand", color_band_pos, color_band_size, grp_mat)

            # Glowing delimiter stripe
            add_box(f"Tile_{idx}_GlowDivider", (tx, ty, 0.605), (0.02 if w < d else 0.7, 0.7 if w < d else 0.02, 0.01), m_rune_cyan)

    # 7. CENTER SCRYING PLAZA & HOLOGRAPHIC HOGWARTS CREST
    print("Building Center Scrying Plaza...")
    # Sunken Plaza Floor
    add_box("Plaza_Floor", (0, 0, 0.46), (7.18, 7.18, 0.04), m_obsidian)
    
    # Octagonal Gold Inlay Frame in Plaza
    add_box("Plaza_Inner_Rim", (0, 0, 0.50), (6.8, 6.8, 0.01), m_gold_trim)
    add_box("Plaza_Smoked_Glass", (0, 0, 0.51), (6.5, 6.5, 0.015), m_obsidian_rough)

    # Central Raised Holographic Podium
    add_box("Hologram_Podium_Base", (0, 0, 0.52), (2.8, 2.8, 0.14), m_obsidian)
    add_box("Hologram_Podium_GoldBevel", (0, 0, 0.66), (2.6, 2.6, 0.03), m_gold_trim)
    add_cylinder("Hologram_Projector_Ring", (0, 0, 0.69), 1.05, 0.03, m_rune_cyan)

    # 4 House Shields on the central podium (Gryffindor, Slytherin, Ravenclaw, Hufflepuff)
    house_shield_offsets = [
        ("Gryffindor", (-0.45, -0.45, 0.72), group_colors['red']),
        ("Slytherin",   ( 0.45, -0.45, 0.72), group_colors['green']),
        ("Ravenclaw",   (-0.45,  0.45, 0.72), group_colors['lightblue']),
        ("Hufflepuff",  ( 0.45,  0.45, 0.72), group_colors['yellow']),
    ]
    for h_name, h_pos, h_mat in house_shield_offsets:
        add_box(f"Shield_{h_name}", h_pos, (0.55, 0.55, 0.03), h_mat)

    # Central Holographic 'H' Emblem & Floating Runes
    add_box("Hogwarts_H_Emblem_1", (0, 0, 0.74), (0.16, 0.7, 0.04), m_gold_trim)
    add_box("Hogwarts_H_Emblem_2", (0, 0, 0.74), (0.16, 0.7, 0.04), m_gold_trim)
    add_box("Hogwarts_H_Crossbar", (0, 0, 0.74), (0.55, 0.16, 0.04), m_gold_trim)
    
    # 2 Sunken Interactive Card Bays
    print("Building Card Trays...")
    # Spells & Curses (West side of center)
    add_box("CardBay_Spells_Recess", (-1.9, 0, 0.52), (1.4, 1.0, 0.06), m_obsidian)
    add_box("CardBay_Spells_Border", (-1.9, 0, 0.58), (1.45, 1.05, 0.015), m_gold_trim)
    add_box("CardDeck_Spells", (-1.9, 0, 0.58), (1.25, 0.85, 0.12), group_colors['card_chance'])

    # Galleons Draw (East side of center)
    add_box("CardBay_Galleons_Recess", (1.9, 0, 0.52), (1.4, 1.0, 0.06), m_obsidian)
    add_box("CardBay_Galleons_Border", (1.9, 0, 0.58), (1.45, 1.05, 0.015), m_gold_trim)
    add_box("CardDeck_Galleons", (1.9, 0, 0.58), (1.25, 0.85, 0.12), group_colors['card_comm'])

    # 8. LIGHTING & CAMERA SETUP
    print("Setting up Studio Lights, World, and Camera...")
    
    # World Background Ambient
    world = bpy.data.worlds.new("StudioWorld")
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.025, 0.028, 0.038, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0
    scene.world = world

    # Camera
    cam_data = bpy.data.cameras.new("MainIsometricCamera")
    cam_data.lens = 42
    cam_data.sensor_width = 36
    cam_obj = bpy.data.objects.new("MainIsometricCamera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Position camera closer to frame the board gorgeously
    cam_obj.location = (9.8, -9.8, 8.2)
    cam_obj.rotation_euler = (math.radians(58), math.radians(0), math.radians(45))

    # Sun Light for crisp golden highlights and shadows
    sun_data = bpy.data.lights.new(name="Sun_Gold_Light", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.94, 0.82)
    sun_obj = bpy.data.objects.new(name="Sun_Gold_Light", object_data=sun_data)
    sun_obj.rotation_euler = (math.radians(45), math.radians(-25), math.radians(35))
    scene.collection.objects.link(sun_obj)

    # Overhead Studio Softbox (Area Light)
    softbox_data = bpy.data.lights.new(name="Studio_Overhead_Area", type='AREA')
    softbox_data.energy = 5500.0
    softbox_data.size = 12.0
    softbox_data.color = (0.95, 0.97, 1.0)
    softbox_obj = bpy.data.objects.new(name="Studio_Overhead_Area", object_data=softbox_data)
    softbox_obj.location = (0, 0, 9.0)
    scene.collection.objects.link(softbox_obj)

    # Rim Cyan Accent Light
    rim_data = bpy.data.lights.new(name="Rim_Cyan_Light", type='AREA')
    rim_data.energy = 3000.0
    rim_data.size = 8.0
    rim_data.color = (0.05, 0.85, 1.0)
    rim_obj = bpy.data.objects.new(name="Rim_Cyan_Light", object_data=rim_data)
    rim_obj.location = (-7.0, 7.0, 6.0)
    rim_obj.rotation_euler = (math.radians(-45), math.radians(30), math.radians(-45))
    scene.collection.objects.link(rim_obj)

    # 9. RENDER PREVIEW IMAGE
    print("Rendering High-Resolution 3D Preview...")
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.film_transparent = False
    
    # Save render to public and artifact folders
    out_render_public = "/Users/khang/monopoly/public/board_3d_render.png"
    out_render_artifact = "/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/blender_board_render.png"
    
    scene.render.filepath = out_render_public
    bpy.ops.render.render(write_still=True)
    
    # Copy to artifact folder
    import shutil
    shutil.copyfile(out_render_public, out_render_artifact)
    print(f"Render saved to: {out_render_public} and {out_render_artifact}")

    # 10. EXPORT GLB MODEL
    print("Exporting GLB 3D Model...")
    out_glb_path = "/Users/khang/monopoly/public/models/hogwarts_board_modern.glb"
    bpy.ops.export_scene.gltf(
        filepath=out_glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"GLB Model exported successfully to: {out_glb_path}")
    print("=== BLENDER GENERATION FINISHED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    run()
