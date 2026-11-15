"""Display language for the model's text ('es' default, 'en'). Only display text changes: crop names, `tipo`,
month codes and every other value the frontend compares stay in Spanish."""
CROP_EN = {"Papa": "Potato", "Cebolla": "Onion", "Ajo": "Garlic", "Quinua": "Quinoa", "Zapallo": "Squash",
           "Haba": "Fava bean", "Maíz": "Maize", "Alfalfa": "Alfalfa", "Paprika": "Paprika", "Vid": "Grapevine",
           "Trigo": "Wheat", "Tomate": "Tomato"}
KIND_EN = {"regado": "irrigated", "mixto (parte regada)": "mixed (partly irrigated)",
           "desierto o sin riego": "desert or not irrigated", "sin dato": "no data"}
MONTH_EN = {"ene": "Jan", "feb": "Feb", "mar": "Mar", "abr": "Apr", "may": "May", "jun": "Jun", "jul": "Jul",
            "ago": "Aug", "set": "Sep", "oct": "Oct", "nov": "Nov", "dic": "Dec"}


def crop(name, lang="es"):
    return CROP_EN.get(name, name) if lang == "en" else name


def crops(names, lang="es", sep=", "):
    return sep.join(crop(c, lang) for c in names)


def kind(value, lang="es"):
    return KIND_EN.get(value, value) if lang == "en" else value


def month(code, lang="es"):
    return MONTH_EN.get(code, code) if lang == "en" else code
