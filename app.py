import os
import json
import re
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure OpenRouter (OpenAI-compatible free API)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = "google/gemma-3-27b-it:free"

client = None
if OPENROUTER_API_KEY:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

# Fashion style categories
STYLE_CATEGORIES = [
    "Streetwear", "Casual", "Formal", "Bohemian", "Athleisure",
    "Vintage", "Minimalist", "Maximalist", "Cottagecore", "Y2K",
    "Grunge", "Preppy", "Gothic", "Business Casual", "Resort Wear"
]

# Color palettes
COLOR_PALETTES = {
    "Monochrome": ["#000000", "#333333", "#666666", "#999999", "#FFFFFF"],
    "Earth Tones": ["#8B4513", "#D2691E", "#DEB887", "#F4A460", "#FFDEAD"],
    "Pastels": ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"],
    "Bold Primaries": ["#FF0000", "#0000FF", "#FFFF00", "#00FF00", "#FF6600"],
    "Ocean": ["#006994", "#0099CC", "#00CED1", "#40E0D0", "#7FFFD4"],
    "Sunset": ["#FF4500", "#FF6347", "#FF7F50", "#FFD700", "#FFA500"],
    "Forest": ["#228B22", "#2E8B57", "#3CB371", "#90EE90", "#98FB98"],
    "Jewel Tones": ["#9B59B6", "#2980B9", "#27AE60", "#E74C3C", "#F39C12"]
}


def chat_completion(system_prompt):
    """Call OpenRouter API with a prompt and return the text response."""
    response = client.chat.completions.create(
        model=OPENROUTER_MODEL,
        messages=[{"role": "user", "content": system_prompt}],
    )
    return response.choices[0].message.content.strip()


def generate_fashion_design(prompt, style, color_palette, occasion, gender):
    """Generate fashion design description using OpenRouter."""
    if not client:
        return get_demo_design(prompt, style, color_palette, occasion, gender)

    try:
        system_prompt = f"""You are an expert fashion designer and stylist. Create a detailed, 
        creative clothing design based on the user's request. 

        User Request: {prompt}
        Style Category: {style}
        Color Palette: {color_palette}
        Occasion: {occasion}
        For: {gender}

        Provide a structured JSON response with the following fields:
        {{
            "design_name": "Creative name for the design",
            "description": "Detailed description of the overall look (2-3 sentences)",
            "garments": [
                {{
                    "type": "garment type (e.g., Top, Pants, Dress)",
                    "name": "specific item name",
                    "description": "detailed description",
                    "fabric": "fabric type",
                    "color": "color description",
                    "details": ["key design detail 1", "key design detail 2", "key design detail 3"]
                }}
            ],
            "accessories": ["accessory 1", "accessory 2", "accessory 3"],
            "styling_tips": ["tip 1", "tip 2", "tip 3"],
            "color_story": "Brief story about the color choices",
            "season": "Best season(s) for this outfit",
            "price_range": "Estimated budget range (e.g., $50-$150)",
            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
        }}

        Be creative, specific, and fashion-forward. Focus on wearable, realistic designs."""

        text = chat_completion(system_prompt)

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            design_data = json.loads(json_match.group())
            return {"success": True, "design": design_data}
        else:
            return {"success": False, "error": "Could not parse design data", "raw": text}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_product_suggestions(design_data, budget_level="mid"):
    """Generate product suggestions based on design using OpenRouter."""
    if not client:
        return get_demo_products(design_data)

    try:
        design_summary = json.dumps(design_data.get("design", {}), indent=2)

        prompt = f"""Based on this fashion design, suggest 6 specific affordable products that 
        students can actually buy online. Budget level: {budget_level}

        Design:
        {design_summary}

        Return a JSON array with 6 product suggestions:
        [
            {{
                "name": "Product Name",
                "type": "Category (e.g., Top, Pants, Shoes)",
                "brand": "Suggested brand (e.g., Zara, H&M, ASOS, Shein, Uniqlo, Primark)",
                "price": "$XX-$XX",
                "description": "Why this matches the design",
                "search_query": "exact search query to find it online",
                "where_to_buy": ["Store1", "Store2"],
                "color": "color variant to look for"
            }}
        ]

        Focus on affordable, accessible brands like Zara, H&M, ASOS, Shein, Uniqlo, Forever 21, 
        Target, Old Navy, ThredUp (secondhand). Keep prices student-friendly ($10-$80 per item)."""

        text = chat_completion(prompt)

        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            products = json.loads(json_match.group())
            return {"success": True, "products": products}
        else:
            return get_demo_products(design_data)

    except Exception as e:
        return get_demo_products(design_data)


def get_style_advice(design_data, user_body_type="", preferences=""):
    """Get personalized styling advice using OpenRouter."""
    if not client:
        return get_demo_advice()

    try:
        design_name = design_data.get("design", {}).get("design_name", "your design")

        prompt = f"""As a fashion stylist, provide personalized styling advice for "{design_name}".
        Body type consideration: {user_body_type if user_body_type else "general"}
        Personal preferences: {preferences if preferences else "none specified"}

        Return JSON:
        {{
            "body_type_tips": ["tip1", "tip2"],
            "how_to_wear": ["step1", "step2", "step3"],
            "occasions": ["occasion1", "occasion2", "occasion3"],
            "what_to_avoid": ["avoid1", "avoid2"],
            "seasonal_variations": {{
                "summer": "summer variation tip",
                "winter": "winter variation tip"
            }},
            "confidence_boost": "Motivational fashion tip"
        }}"""

        text = chat_completion(prompt)

        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            advice = json.loads(json_match.group())
            return {"success": True, "advice": advice}
        else:
            return get_demo_advice()

    except Exception as e:
        return get_demo_advice()


def get_demo_design(prompt, style, color_palette, occasion, gender):
    """Demo design when no API key is set."""
    request_text = f"{prompt} {style} {occasion}".lower()
    demo_looks = [
        {
            "keywords": ["street", "grunge", "y2k", "urban", "casual"],
            "design_name": "City Layered Statement Look",
            "description": "A confident streetwear outfit built around relaxed proportions, practical layers, and a polished edge for everyday city style.",
            "garments": [
                {"type": "Top", "name": "Cropped Utility Jacket", "description": "Relaxed jacket with contrast stitching, oversized pockets, and a structured collar", "fabric": "Washed cotton twill", "color": "Deep olive", "details": ["Adjustable cuffs", "Metal zip closure", "Utility pockets"]},
                {"type": "Bottom", "name": "Relaxed Cargo Trousers", "description": "High-rise cargo trousers with a straight leg and adjustable ankle tabs", "fabric": "Lightweight ripstop cotton", "color": "Charcoal", "details": ["Six utility pockets", "Reinforced knees", "Drawcord waist"]}
            ],
            "accessories": ["Canvas high-top sneakers", "Silver chain necklace", "Compact crossbody bag"],
            "styling_tips": ["Roll the jacket sleeves for a relaxed finish", "Keep the base layer simple to balance the utility details", "Add one metallic accessory for contrast"],
            "season": "Autumn/Winter, Transitional",
            "price_range": "$55-$125",
            "tags": ["streetwear", occasion, gender, "layered", "student-friendly"]
        },
        {
            "keywords": ["bohemian", "boho", "cottage", "resort", "beach", "festival"],
            "design_name": "Sunlit Free-Spirit Ensemble",
            "description": "A relaxed bohemian look with soft movement, warm texture, and easy layers designed for sunny days and creative escapes.",
            "garments": [
                {"type": "Top", "name": "Embroidered Wrap Blouse", "description": "Lightweight wrap blouse with gently flared sleeves and tonal embroidery", "fabric": "Airy cotton voile", "color": "Warm ivory", "details": ["Adjustable waist tie", "V-neckline", "Textured embroidery"]},
                {"type": "Bottom", "name": "Flowing Midi Skirt", "description": "High-waist tiered skirt with soft volume and a comfortable elastic back", "fabric": "Printed rayon", "color": "Terracotta and cream", "details": ["Tiered hem", "Side pockets", "Hidden side zip"]}
            ],
            "accessories": ["Leather slide sandals", "Woven shoulder bag", "Layered pendant necklace"],
            "styling_tips": ["Add a denim layer when the evening gets cool", "Choose natural textures to reinforce the relaxed mood", "Wear the blouse loosely tied for an effortless silhouette"],
            "season": "Spring/Summer",
            "price_range": "$45-$110",
            "tags": ["bohemian", occasion, gender, "resort", "comfortable"]
        },
        {
            "keywords": ["athleisure", "sports", "active", "gym", "workout"],
            "design_name": "Sculpted Active Essentials",
            "description": "A streamlined activewear set combining supportive performance pieces with clean styling for movement, errands, and casual plans.",
            "garments": [
                {"type": "Top", "name": "Sculpted Performance Tank", "description": "Supportive racerback tank with breathable panels and a softly curved hem", "fabric": "Moisture-wicking recycled knit", "color": "Cobalt blue", "details": ["Built-in support", "Breathable back panel", "Reflective logo detail"]},
                {"type": "Bottom", "name": "High-Rise Training Leggings", "description": "Full-length leggings with a secure waistband and flexible four-way stretch", "fabric": "Matte stretch jersey", "color": "Black", "details": ["Phone pocket", "Flatlock seams", "Squat-proof finish"]}
            ],
            "accessories": ["Lightweight running shoes", "Minimal sports watch", "Packable nylon tote"],
            "styling_tips": ["Layer with a cropped windbreaker outdoors", "Choose one bright accent to keep the outfit focused", "Use a sleek tote to transition from studio to street"],
            "season": "All Season",
            "price_range": "$50-$135",
            "tags": ["athleisure", occasion, gender, "performance", "versatile"]
        },
        {
            "keywords": ["formal", "office", "business", "wedding", "date", "party"],
            "design_name": "Modern Tailored Evening Look",
            "description": "A refined tailored ensemble balancing clean lines with a subtle statement detail for dinners, celebrations, and polished work settings.",
            "garments": [
                {"type": "Top", "name": "Satin Panel Blazer", "description": "Single-button blazer with softly defined shoulders and a luminous satin lapel", "fabric": "Smooth wool blend", "color": "Midnight navy", "details": ["Satin lapel", "Single-button closure", "Fully lined interior"]},
                {"type": "Bottom", "name": "Pleated Tapered Trousers", "description": "High-waist trousers with a clean taper and a flattering pressed crease", "fabric": "Stretch suiting", "color": "Midnight navy", "details": ["Front pleats", "Ankle-length hem", "Slant pockets"]}
            ],
            "accessories": ["Pointed leather loafers", "Slim watch", "Structured top-handle bag"],
            "styling_tips": ["Keep the shirt or camisole in a lighter neutral", "Choose polished accessories with simple shapes", "Swap loafers for heels when dressing for evening"],
            "season": "Autumn/Winter, Formal",
            "price_range": "$90-$220",
            "tags": ["tailored", occasion, gender, "polished", "timeless"]
        }
    ]

    selected_look = next(
        (look for look in demo_looks if any(keyword in request_text for keyword in look["keywords"])),
        demo_looks[0]
    )

    return {
        "success": True,
        "design": {
            "design_name": selected_look["design_name"],
            "description": selected_look["description"],
            "garments": selected_look["garments"],
            "accessories": selected_look["accessories"],
            "styling_tips": selected_look["styling_tips"],
            "color_story": f"Inspired by {color_palette} tones, this palette creates a sophisticated harmony between contrast and cohesion.",
            "season": selected_look["season"],
            "price_range": selected_look["price_range"],
            "tags": [style, *selected_look["tags"][1:]]
        }
    }


def get_demo_products(design_data):
    """Demo products when no API key is set."""
    return {
        "success": True,
        "products": [
            {"name": "Oversized Blazer", "type": "Top", "brand": "Zara", "price": "$49-$69",
             "description": "Perfect structured blazer match for the design", "search_query": "zara oversized blazer women",
             "where_to_buy": ["Zara.com", "ASOS"], "color": "Ivory/Cream"},
            {"name": "Wide Leg Trousers", "type": "Bottom", "brand": "H&M", "price": "$24-$35",
             "description": "Affordable wide-leg pants in charcoal", "search_query": "h&m wide leg trousers charcoal",
             "where_to_buy": ["H&M.com", "ASOS"], "color": "Charcoal Gray"},
            {"name": "White Chunky Sneakers", "type": "Shoes", "brand": "ASOS Design", "price": "$45-$55",
             "description": "Clean white sneakers to complete the look", "search_query": "asos chunky white sneakers",
             "where_to_buy": ["ASOS", "Schuh"], "color": "White"},
            {"name": "Gold Chain Necklace Set", "type": "Accessory", "brand": "Shein", "price": "$8-$15",
             "description": "Layered gold chains matching the design", "search_query": "shein layered gold chain necklace set",
             "where_to_buy": ["Shein.com", "Amazon"], "color": "Gold"},
            {"name": "Mini Structured Bag", "type": "Bag", "brand": "Primark", "price": "$18-$25",
             "description": "Compact structured bag for the polished look", "search_query": "primark mini structured handbag",
             "where_to_buy": ["Primark", "ASOS"], "color": "White/Nude"},
            {"name": "Silk Hair Scarf", "type": "Accessory", "brand": "Uniqlo", "price": "$12-$20",
             "description": "Versatile silk scarf for neck or hair styling", "search_query": "uniqlo silk scarf",
             "where_to_buy": ["Uniqlo.com", "Amazon"], "color": "Neutral tones"}
        ]
    }


def get_demo_advice():
    return {
        "success": True,
        "advice": {
            "body_type_tips": ["This silhouette works beautifully for all body types", "High-waist bottoms create elongating proportions"],
            "how_to_wear": ["Start with your base layer fitted trousers", "Add the blazer and leave one button open", "Complete with accessories last"],
            "occasions": ["Campus lectures", "Coffee dates", "Part-time work", "Art gallery visits"],
            "what_to_avoid": ["Avoid over-accessorizing — keep it to 2-3 pieces", "Skip overly casual footwear like flip-flops"],
            "seasonal_variations": {"summer": "Swap trousers for wide-leg shorts", "winter": "Layer a turtleneck underneath the blazer"},
            "confidence_boost": "Fashion is your personal art canvas — wear what makes you feel unstoppable!"
        }
    }


@app.route("/")
def index():
    return render_template("index.html",
                           styles=STYLE_CATEGORIES,
                           palettes=list(COLOR_PALETTES.keys()))


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json()
    prompt = data.get("prompt", "")
    style = data.get("style", "Casual")
    color_palette = data.get("color_palette", "Monochrome")
    occasion = data.get("occasion", "Everyday")
    gender = data.get("gender", "Any")

    if not prompt:
        return jsonify({"success": False, "error": "Please provide a design prompt"}), 400

    result = generate_fashion_design(prompt, style, color_palette, occasion, gender)
    return jsonify(result)


@app.route("/api/products", methods=["POST"])
def products():
    data = request.get_json()
    design_data = data.get("design_data", {})
    budget = data.get("budget", "mid")
    result = get_product_suggestions(design_data, budget)
    return jsonify(result)


@app.route("/api/advice", methods=["POST"])
def advice():
    data = request.get_json()
    design_data = data.get("design_data", {})
    body_type = data.get("body_type", "")
    preferences = data.get("preferences", "")
    result = get_style_advice(design_data, body_type, preferences)
    return jsonify(result)


@app.route("/api/palettes", methods=["GET"])
def palettes():
    return jsonify(COLOR_PALETTES)


@app.route("/api/status", methods=["GET"])
def status():
    has_key = bool(OPENROUTER_API_KEY)
    return jsonify({
        "api_configured": has_key,
        "mode": "AI-Powered" if has_key else "Demo Mode",
        "model": OPENROUTER_MODEL if has_key else "demo"
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
