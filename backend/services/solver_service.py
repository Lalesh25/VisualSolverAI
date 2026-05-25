from sympy import symbols, Eq, solve

def solve_motion(distance: float, speed: float) -> str:
    d, s, t = symbols('d s t')
    eq = Eq(d, s * t)
    result = solve(eq.subs({d: distance, s: speed}), t)
    return f'Time = {result[0]} seconds' if result else 'Could not solve equation.'
