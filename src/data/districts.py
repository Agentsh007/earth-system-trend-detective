"""
Official district metadata for all 64 districts of Bangladesh.
Includes centroid coordinates (lat, lon), division, and regional classifications.
"""

from typing import Dict, List, Any

DISTRICTS_METADATA: Dict[str, Dict[str, Any]] = {
    # Dhaka Division
    "Dhaka": {"lat": 23.8103, "lon": 90.4125, "division": "Dhaka", "code": "DHA"},
    "Gazipur": {"lat": 24.0023, "lon": 90.4267, "division": "Dhaka", "code": "GAZ"},
    "Narayanganj": {"lat": 23.6238, "lon": 90.5000, "division": "Dhaka", "code": "NAR"},
    "Tangail": {"lat": 24.2513, "lon": 89.9167, "division": "Dhaka", "code": "TAN"},
    "Kishoreganj": {"lat": 24.4449, "lon": 90.7766, "division": "Dhaka", "code": "KIS"},
    "Manikganj": {"lat": 23.8617, "lon": 90.0003, "division": "Dhaka", "code": "MAN"},
    "Munshiganj": {"lat": 23.5422, "lon": 90.5305, "division": "Dhaka", "code": "MUN"},
    "Narsingdi": {"lat": 23.9322, "lon": 90.7154, "division": "Dhaka", "code": "NSI"},
    "Faridpur": {"lat": 23.6071, "lon": 89.8429, "division": "Dhaka", "code": "FAR"},
    "Gopalganj": {"lat": 23.0051, "lon": 89.8266, "division": "Dhaka", "code": "GOP"},
    "Madaripur": {"lat": 23.1641, "lon": 90.1897, "division": "Dhaka", "code": "MAD"},
    "Rajbari": {"lat": 23.7574, "lon": 89.6445, "division": "Dhaka", "code": "RAJ"},
    "Shariatpur": {"lat": 23.2423, "lon": 90.4348, "division": "Dhaka", "code": "SHA"},

    # Chattogram Division
    "Chattogram": {"lat": 22.3569, "lon": 91.7832, "division": "Chattogram", "code": "CTG"},
    "Cox's Bazar": {"lat": 21.4272, "lon": 92.0058, "division": "Chattogram", "code": "CXB"},
    "Cumilla": {"lat": 23.4682, "lon": 91.1788, "division": "Chattogram", "code": "COM"},
    "Feni": {"lat": 23.0159, "lon": 91.3976, "division": "Chattogram", "code": "FEN"},
    "Brahmanbaria": {"lat": 23.9571, "lon": 91.1119, "division": "Chattogram", "code": "BRA"},
    "Rangamati": {"lat": 22.7324, "lon": 92.2985, "division": "Chattogram", "code": "RAN"},
    "Noakhali": {"lat": 22.8696, "lon": 91.0998, "division": "Chattogram", "code": "NOA"},
    "Chandpur": {"lat": 23.2333, "lon": 90.6667, "division": "Chattogram", "code": "CHA"},
    "Lakshmipur": {"lat": 22.9425, "lon": 90.8412, "division": "Chattogram", "code": "LAK"},
    "Khagrachhari": {"lat": 23.1193, "lon": 91.9847, "division": "Chattogram", "code": "KHA"},
    "Bandarban": {"lat": 22.1953, "lon": 92.2184, "division": "Chattogram", "code": "BAN"},

    # Rajshahi Division
    "Rajshahi": {"lat": 24.3745, "lon": 88.6042, "division": "Rajshahi", "code": "RAJ_DIST"},
    "Bogura": {"lat": 24.8465, "lon": 89.3777, "division": "Rajshahi", "code": "BOG"},
    "Pabna": {"lat": 24.0064, "lon": 89.2372, "division": "Rajshahi", "code": "PAB"},
    "Sirajganj": {"lat": 24.4534, "lon": 89.7008, "division": "Rajshahi", "code": "SIR"},
    "Naogaon": {"lat": 24.8143, "lon": 88.9389, "division": "Rajshahi", "code": "NAO"},
    "Natore": {"lat": 24.4206, "lon": 89.0003, "division": "Rajshahi", "code": "NAT"},
    "Chapai Nawabganj": {"lat": 24.5965, "lon": 88.2775, "division": "Rajshahi", "code": "CNG"},
    "Joypurhat": {"lat": 25.1015, "lon": 89.0277, "division": "Rajshahi", "code": "JOY"},

    # Khulna Division
    "Khulna": {"lat": 22.8456, "lon": 89.5403, "division": "Khulna", "code": "KHU"},
    "Jashore": {"lat": 23.1664, "lon": 89.2182, "division": "Khulna", "code": "JAS"},
    "Satkhira": {"lat": 22.7185, "lon": 89.0705, "division": "Khulna", "code": "SAT"},
    "Bagerhat": {"lat": 22.6516, "lon": 89.7859, "division": "Khulna", "code": "BAG"},
    "Kushtia": {"lat": 23.9013, "lon": 89.1205, "division": "Khulna", "code": "KUS"},
    "Jhenaidah": {"lat": 23.5448, "lon": 89.1539, "division": "Khulna", "code": "JHE"},
    "Chuadanga": {"lat": 23.6402, "lon": 88.8418, "division": "Khulna", "code": "CHU"},
    "Magura": {"lat": 23.4873, "lon": 89.4199, "division": "Khulna", "code": "MAG"},
    "Meherpur": {"lat": 23.7725, "lon": 88.6322, "division": "Khulna", "code": "MEH"},
    "Narail": {"lat": 23.1725, "lon": 89.5127, "division": "Khulna", "code": "NAR_DIST"},

    # Barishal Division
    "Barishal": {"lat": 22.7010, "lon": 90.3535, "division": "Barishal", "code": "BAR"},
    "Bhola": {"lat": 22.6859, "lon": 90.6481, "division": "Barishal", "code": "BHO"},
    "Patuakhali": {"lat": 22.3596, "lon": 90.3299, "division": "Barishal", "code": "PAT"},
    "Pirojpur": {"lat": 22.5841, "lon": 89.9720, "division": "Barishal", "code": "PIR"},
    "Barguna": {"lat": 22.1570, "lon": 90.1256, "division": "Barishal", "code": "BRG"},
    "Jhalokathi": {"lat": 22.6406, "lon": 90.1987, "division": "Barishal", "code": "JHA"},

    # Sylhet Division
    "Sylhet": {"lat": 24.8949, "lon": 91.8687, "division": "Sylhet", "code": "SYL"},
    "Moulvibazar": {"lat": 24.4829, "lon": 91.7774, "division": "Sylhet", "code": "MOU"},
    "Habiganj": {"lat": 24.3749, "lon": 91.4155, "division": "Sylhet", "code": "HAB"},
    "Sunamganj": {"lat": 25.0658, "lon": 91.3950, "division": "Sylhet", "code": "SUN"},

    # Rangpur Division
    "Rangpur": {"lat": 25.7439, "lon": 89.2752, "division": "Rangpur", "code": "RAN_DIST"},
    "Dinajpur": {"lat": 25.6217, "lon": 88.6355, "division": "Rangpur", "code": "DIN"},
    "Gaibandha": {"lat": 25.3288, "lon": 89.5403, "division": "Rangpur", "code": "GAI"},
    "Kurigram": {"lat": 25.8054, "lon": 89.6362, "division": "Rangpur", "code": "KUR"},
    "Lalmonirhat": {"lat": 25.9923, "lon": 89.2847, "division": "Rangpur", "code": "LAL"},
    "Nilphamari": {"lat": 25.9318, "lon": 88.8560, "division": "Rangpur", "code": "NIL"},
    "Panchagarh": {"lat": 26.3411, "lon": 88.5542, "division": "Rangpur", "code": "PAN"},
    "Thakurgaon": {"lat": 26.0337, "lon": 88.4617, "division": "Rangpur", "code": "THA"},

    # Mymensingh Division
    "Mymensingh": {"lat": 24.7471, "lon": 90.4203, "division": "Mymensingh", "code": "MYM"},
    "Jamalpur": {"lat": 24.9375, "lon": 89.9378, "division": "Mymensingh", "code": "JAM"},
    "Netrokona": {"lat": 24.8770, "lon": 90.7277, "division": "Mymensingh", "code": "NET"},
    "Sherpur": {"lat": 25.0205, "lon": 90.0153, "division": "Mymensingh", "code": "SHE"},
}


def get_district_list() -> List[Dict[str, Any]]:
    """Return all districts as a list of dictionaries."""
    return [
        {"name": name, **meta}
        for name, meta in sorted(DISTRICTS_METADATA.items(), key=lambda x: x[0])
    ]


def get_district_metadata(name: str) -> Dict[str, Any]:
    """Retrieve metadata for a specific district (case-insensitive)."""
    normalized = name.strip().lower()
    for d_name, meta in DISTRICTS_METADATA.items():
        if d_name.lower() == normalized:
            return {"name": d_name, **meta}
    raise KeyError(f"District '{name}' not found among Bangladesh's 64 districts.")

